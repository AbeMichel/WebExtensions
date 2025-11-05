// ==UserScript==
// @name         Moodle Grading Helper Enhanced
// @description  Adds a button to cycle through student names and fill the search box automatically in Moodle
// @match        https://moodle-courses2527.wolfware.ncsu.edu/mod/forum/*
// @version      3.0
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // Constants
  const TOOLBAR_CLASS = "abes-super-grader-toolbar";
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const FULL_NAME_COL = 0;
  const GROUP_COL = 5;
  const GROUPS = ["A", "B", "C"];
  
  // Timeouts
  const SEARCH_WAIT_MS = 1000;
  const NAME_CHANGE_TIMEOUT = 5000;
  const CHILDREN_WAIT_TIMEOUT = 5000;
  const DEBOUNCE_DELAY = 300;

  // State
  const state = {
    fileString: "",
    students: [],
    index: 0,
    isTransitioning: false,
    isMinimized: false,
    jumpPopup: null,
    jumpInput: null,
    resultsDropdown: null
  };

  // DOM elements (cached)
  const dom = {
    toolbar: null,
    status: null,
    nextButton: null,
    prevButton: null,
    skipCheckbox: null,
    autoGradeZeros: null,
  };

  // Selectors
  const SELECTORS = {
    searchToggle: "button.toggle-search-button",
    searchInput: "input[data-region='user-search-input']",
    searchResults: "div[data-region='search-results-container']",
    selectUserButton: "button[data-action='select-user']",
    userName: "h5[data-region='name'].user-full-name",
    statusContainer: "div[data-region='status-container'] h2",
    saveButton: "button[data-action='savegrade']",
    gradingWindow: ".unified-grader",
    scoringPanel: "div[data-region='body-container']",
    discussionPanel: `div[aria-label="User's forum posts"]`,
    noPostContainer: ".no-post-container",
    scoreInput: ".mb-3.criterion .mb-3 input",
    postInstance: ".posts-container",
  };

  /**
   * Utility: Sleep function
   */
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Utility: Debounce function
   */
  function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Check if file is older than 7 days
   */
  function isFileStale(file) {
    return (Date.now() - file.lastModified) > SEVEN_DAYS_MS;
  }

  /**
   * Name manipulation utilities
   */
  const NameUtils = {
    removeMiddleName(fullName) {
      if (!fullName) return "";
      const parts = fullName.trim().split(/\s+/);
      if (parts.length <= 2) return fullName;
      return `${parts[0]} ${parts[parts.length - 1]}`;
    },

    getFirstName(fullName) {
      if (!fullName) return "";
      const parts = fullName.trim().split(/\s+/);
      return parts[0] || fullName;
    }
  };

  /**
   * Upload and read CSV file
   */
  function uploadCSV() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv";

      input.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return reject(new Error("No file selected"));

        if (isFileStale(file)) {
          alert("⚠️ Grading roll is over 7 days old. Consider downloading a new roll to avoid stale data.");
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          state.fileString = event.target.result;
          resolve(state.fileString);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
      });

      input.click();
    });
  }

  /**
   * Load students from CSV file for specific group
   */
  async function loadStudentsFromFile(key) {
    try {
      if (!state.fileString || state.fileString.trim() === "") {
        await uploadCSV();
      }

      const rows = state.fileString
        .trim()
        .split("\n")
        .map(line => line.split(",").map(cell => cell.trim()))
        .filter(cols => cols.length > GROUP_COL); // Validate row has enough columns

      // Filter by group and extract names
      state.students = rows
        .filter(cols => cols[GROUP_COL]?.toLowerCase() === key.toLowerCase())
        .map(cols => cols[FULL_NAME_COL])
        .filter(name => name && name.trim() !== ""); // Remove empty names

      if (state.students.length === 0) {
        alert(`⚠️ No students found for group "${key}". Check your CSV format.`);
        return;
      }

      // Start at index 0 and navigate to first student
      state.index = 0;
      await fillNextStudent(false); // Don't save, just navigate

      alert(`✓ Loaded ${state.students.length} students for group "${key}".`);
    } catch (err) {
      console.error("Error loading students:", err);
      alert(`❌ Failed to load students: ${err.message}`);
    }
  }

  /**
   * Wait for name change in DOM
   */
  async function waitForNameChange(expectedName, oldName = null, timeout = NAME_CHANGE_TIMEOUT) {
    const startTime = Date.now();
    
    // If no old name provided, get current name
    if (oldName === null) {
      const nameElement = document.querySelector(SELECTORS.userName);
      oldName = nameElement?.innerText.trim() || "";
    }

    while (Date.now() - startTime < timeout) {
      const currentElement = document.querySelector(SELECTORS.userName);
      if (currentElement) {
        const currentName = currentElement.innerText.trim();
        if (currentName !== oldName && currentName !== "") {
          await sleep(200); // Stabilization delay
          return true;
        }
      }
      await sleep(50);
    }

    console.warn(`Name did not change from "${oldName}" to "${expectedName}" within ${timeout}ms`);
    return false;
  }

  /**
   * Wait for DOM children to appear
   */
  function waitForChildren(selector, timeout = CHILDREN_WAIT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      const parent = document.querySelector(selector);
      if (!parent) {
        return reject(new Error(`Parent not found: ${selector}`));
      }

      if (parent.children.length >= 1) {
        return resolve(parent);
      }

      const observer = new MutationObserver(() => {
        if (parent.children.length >= 1) {
          observer.disconnect();
          resolve(parent);
        }
      });

      observer.observe(parent, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout: children not added to ${selector}`));
      }, timeout);
    });
  }

  /**
   * Scroll to the top of the grading panel and to the first post in the discussion body
   */
  function scrollToStartSpot() {
    const gradingPanel = document.querySelector(SELECTORS.scoringPanel);
    const discussionPanel = document.querySelector(SELECTORS.discussionPanel);

    if (gradingPanel) {
      if (typeof gradingPanel.scrollTo === "function"){
        gradingPanel.scrollTo({ top: 0, behavior: "auto" });
      } else {
        gradingPanel.scrollTop = 0;
      }
    } else {
      console.warn("Scoring panel not found");
    }

    if (discussionPanel) {
      const posts = document.querySelectorAll(SELECTORS.postInstance);
      if (posts.length > 0){
        const lastPost = posts[posts.length - 1];
        lastPost.scrollIntoView({ behavior: "auto", block: "start" });
      } else {
        discussionPanel.scrollTo({ top: 0, behavior: "auto" });
      }
    } else {
      console.warn("Discussion panel not found");
    }
  }

  /**
   * Check if current student is already graded
   */
  function isGraded() {
    const statusElement = document.querySelector(SELECTORS.statusContainer);
    if (!statusElement) return false;
    return !statusElement.innerText.toLowerCase().includes("not");
  }

  /**
   * Checks if the no post container exists which means there are no posts.
   * @returns false if the user doesn't have any posts, true otherwise.
   */
  function hasPosts() {
    const noPostElement = document.querySelector(SELECTORS.noPostContainer);
    return !noPostElement;
  }

  function focusFirstGradeBox(fillWithZero = false) {
    const firstGradeBox = document.querySelector(SELECTORS.scoreInput);

    if (!firstGradeBox) {
      console.warn("No grading input found");
      return false;
    }

    // Bring it into view and focus
    firstGradeBox.scrollIntoView({ behavior: "auto", block: "center" });
    firstGradeBox.focus();

    // If fillWithZero is requested and the field is numeric or empty
    if (fillWithZero) {
      const val = firstGradeBox.value.trim();

      // Only overwrite if empty or numeric
      if (val === "" || !isNaN(val)) {
        firstGradeBox.value = 0;
        // Trigger Moodle's reactive listeners
        firstGradeBox.dispatchEvent(new Event("input", { bubbles: true }));
        firstGradeBox.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    return true;
  }

  /**
   * Save the grading of the current student
   */
  async function saveStudentGrade() {
    const saveButton = document.querySelector(SELECTORS.saveButton);
    if (!saveButton) {
      console.warn("Save button not found");
      return;
    }

    saveButton.click();
    await sleep(500);
  }

  /**
   * Open search toggle
   */
  async function openSearchToggle() {
    const toggle = document.querySelector(SELECTORS.searchToggle);
    if (!toggle) {
      console.warn("Search toggle not found");
      return;
    }

    toggle.click();
    await sleep(100);
  }

  /**
   * Fill student name in search bar
   */
  async function fillStudent(name) {
    const searchBar = document.querySelector(SELECTORS.searchInput);
    if (!searchBar) {
      console.warn("Search bar not found");
      return false;
    }

    searchBar.value = name;
    searchBar.dispatchEvent(new Event("input", { bubbles: true }));
    searchBar.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(100);
    return true;
  }

  /**
   * Select student from search results
   */
  async function selectStudent() {
    try {
      await waitForChildren(SELECTORS.searchResults, CHILDREN_WAIT_TIMEOUT);
      await sleep(SEARCH_WAIT_MS);

      const studentButtons = document.querySelectorAll(SELECTORS.selectUserButton);

      if (!studentButtons || studentButtons.length === 0) {
        console.warn("No students found in search results");
        return false;
      }

      if (studentButtons.length > 1) {
        alert("⚠️ Multiple students match. Please select manually.");
        return false;
      }

      studentButtons[0].click();
      await sleep(200);
      return true;
    } catch (err) {
      console.error("Error selecting student:", err);
      return false;
    }
  }

  /**
   * Try selecting student with all name permutations
   */
  async function trySelectingStudentAllPermutations(index) {
    const name = state.students[index];
    if (!name) {
      console.error(`No student at index ${index}`);
      return false;
    }

    // Try full name first
    await fillStudent(name);
    let res = await selectStudent();
    
    if (!res) {
      // Try without middle name
      await fillStudent(NameUtils.removeMiddleName(name));
      res = await selectStudent();
      
      if (!res) {
        // Try first name only
        await fillStudent(NameUtils.getFirstName(name));
        res = await selectStudent();
      }
    }

    if (!res) {
      alert(`❌ Unable to find student: ${name}`);
      return false;
    }

    await waitForNameChange(name);
    return true;
  }

  /**
   * Navigate to next student
   */
  async function fillNextStudent(saveGrade = true) {
    if (state.isTransitioning) {
      console.warn("Already transitioning");
      return;
    }
    
    if (state.students.length === 0) {
      alert("⚠️ No students loaded. Please load a group first.");
      return;
    }

    state.isTransitioning = true;

    try {
      if (saveGrade) {
        await saveStudentGrade();
      }

      if (state.index >= state.students.length) {
        alert("✓ All students graded!");
        state.isTransitioning = false;
        return;
      }

      while (state.index < state.students.length) {
        await openSearchToggle();
        const success = await trySelectingStudentAllPermutations(state.index);
        
        if (!success) {
          state.index++;
          continue;
        }

        if (dom.skipCheckbox?.checked && isGraded()) {
          state.index++;
          continue;
        }

        if (dom.autoGradeZeros?.checked && !hasPosts()) {
          focusFirstGradeBox(true);
          console.log(`Gave ${state.students[state.index]} a 0 for no posts.`);
          await saveStudentGrade();
          state.index++;
          continue;
        }

        state.index++;
        scrollToStartSpot();
        focusFirstGradeBox();
        break;
      }

      updateStatus();
    } catch (err) {
      console.error("Error in fillNextStudent:", err);
      alert(`Error navigating to next student: ${err.message}`);
    } finally {
      state.isTransitioning = false;
    }
  }

  /**
   * Navigate to previous student
   */
  async function prevStudent() {
    if (state.index > 1) {
      state.index -= 2;
      await fillNextStudent(false);
    } else {
      alert("⚠️ Already at first student");
    }
  }

  /**
   * Jump to specific index
   */
  async function jumpToIndex(idx) {
    if (idx < 0 || idx >= state.students.length) {
      alert(`⚠️ Invalid index: ${idx + 1}`);
      return;
    }
    state.index = idx;
    await fillNextStudent(false);
  }

  /**
   * Create styled button
   */
  function createButton(label, onClick, backgroundColor = "#4CAF50", width = "75px") {
    const btn = document.createElement("button");
    btn.textContent = label;

    Object.assign(btn.style, {
      padding: "6px 12px",
      width,
      height: "30px",
      background: backgroundColor,
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "12px",
      textAlign: "center",
      transition: "opacity 0.2s"
    });

    btn.addEventListener("mouseenter", () => btn.style.opacity = "0.8");
    btn.addEventListener("mouseleave", () => btn.style.opacity = "1");
    btn.addEventListener("click", onClick);
    
    return btn;
  }

  /**
   * Update status display
   */
  function updateStatus() {
    if (!dom.status) return;

    const current = Math.min(state.index + 1, state.students.length);
    const total = state.students.length;
    
    dom.status.textContent = `Student ${current}/${total}`;
    dom.status.title = "Click to jump to specific student";

    if (dom.nextButton && state.students[state.index]) {
      dom.nextButton.title = state.students[state.index] || "No more students";
    }
    
    if (dom.prevButton && state.index > 0) {
      dom.prevButton.title = state.students[state.index - 1] || "At first student";
    }
  }

  /**
   * Jump popup functionality
   */
  function showJumpPopup() {
    if (state.jumpPopup) {
      closeJumpPopup();
      return;
    }

    const gradingWindow = document.querySelector(SELECTORS.gradingWindow);
    const container = gradingWindow || dom.toolbar;

    state.jumpPopup = document.createElement("div");
    Object.assign(state.jumpPopup.style, {
      position: "absolute",
      top: "40px",
      left: "10px",
      background: "#222",
      border: "1px solid #555",
      borderRadius: "6px",
      padding: "8px",
      zIndex: "9999999",
      boxShadow: "0 2px 8px rgba(0,0,0,0.5)"
    });

    state.jumpInput = document.createElement("input");
    Object.assign(state.jumpInput.style, {
      width: "200px",
      padding: "6px",
      fontSize: "13px",
      borderRadius: "4px",
      border: "1px solid #888",
      outline: "none"
    });
    state.jumpInput.placeholder = "Enter # or name";

    state.resultsDropdown = document.createElement("div");
    Object.assign(state.resultsDropdown.style, {
      marginTop: "6px",
      maxHeight: "120px",
      overflowY: "auto",
      fontSize: "13px",
      color: "#eee"
    });

    state.jumpPopup.appendChild(state.jumpInput);
    state.jumpPopup.appendChild(state.resultsDropdown);
    container.appendChild(state.jumpPopup);

    // Event handlers
    state.jumpInput.addEventListener("input", debounce(handleJumpSearch, DEBOUNCE_DELAY));
    state.jumpInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await executeJump(state.jumpInput.value.trim());
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeJumpPopup();
      }
    });

    document.addEventListener("mousedown", outsideClickClose);
    
    setTimeout(() => state.jumpInput?.focus(), 50);
  }

  function closeJumpPopup() {
    if (state.jumpPopup) {
      state.jumpPopup.remove();
      state.jumpPopup = null;
      state.jumpInput = null;
      state.resultsDropdown = null;
      document.removeEventListener("mousedown", outsideClickClose);
    }
  }

  function outsideClickClose(e) {
    if (state.jumpPopup && !state.jumpPopup.contains(e.target) && e.target !== dom.status) {
      closeJumpPopup();
    }
  }

  function handleJumpSearch() {
    if (!state.resultsDropdown) return;
    state.resultsDropdown.innerHTML = "";

    const query = state.jumpInput.value.trim();
    if (!query) return;

    const num = parseInt(query, 10);
    if (!isNaN(num) && num > 0 && num <= state.students.length) {
      const name = state.students[num - 1];
      const option = createResultOption(name, num - 1);
      state.resultsDropdown.appendChild(option);
      return;
    }

    // Search names
    const lowerQuery = query.toLowerCase();
    const matches = state.students
      .map((name, idx) => ({ name, idx }))
      .filter(s => s.name.toLowerCase().includes(lowerQuery))
      .slice(0, 5);

    matches.forEach(({ name, idx }) => {
      const option = createResultOption(name, idx);
      state.resultsDropdown.appendChild(option);
    });
  }

  function createResultOption(name, idx) {
    const div = document.createElement("div");
    div.textContent = `${idx + 1}. ${name}`;
    Object.assign(div.style, {
      padding: "4px 6px",
      cursor: "pointer",
      borderRadius: "3px"
    });
    
    div.addEventListener("mouseenter", () => div.style.background = "#444");
    div.addEventListener("mouseleave", () => div.style.background = "transparent");
    div.addEventListener("click", async () => {
      await jumpToIndex(idx);
      closeJumpPopup();
    });
    
    return div;
  }

  async function executeJump(query) {
    if (!query) return;

    const num = parseInt(query, 10);
    if (!isNaN(num) && num > 0 && num <= state.students.length) {
      await jumpToIndex(num - 1);
      closeJumpPopup();
      return;
    }

    const lowerQuery = query.toLowerCase();
    const idx = state.students.findIndex(name => name.toLowerCase().includes(lowerQuery));
    
    if (idx !== -1) {
      await jumpToIndex(idx);
      closeJumpPopup();
    } else {
      alert(`❌ No match found for "${query}"`);
    }
  }

  /**
   * Initialize toolbar
   */
  function initializeToolbar() {
    // Remove existing toolbar
    const existingToolbar = document.querySelector(`.${TOOLBAR_CLASS}`);
    existingToolbar?.remove();

    // Create toolbar
    dom.toolbar = document.createElement("div");
    dom.toolbar.classList.add(TOOLBAR_CLASS);

    Object.assign(dom.toolbar.style, {
      position: "fixed",
      top: "0",
      left: "0",
      background: "#333",
      color: "white",
      padding: "8px 20px",
      display: "flex",
      gap: "10px",
      alignItems: "center",
      zIndex: "999999",
      fontFamily: "sans-serif",
      fontSize: "14px",
      boxShadow: "0 2px 5px rgba(0,0,0,0.3)"
    });

    document.body.style.marginTop = "60px";

    // Minimize button
    const minimizeButton = createButton("−", () => {
      state.isMinimized = !state.isMinimized;
      const children = dom.toolbar.querySelectorAll("button, span, label");

      children.forEach(el => {
        if (el !== minimizeButton) {
          el.style.display = state.isMinimized ? "none" : "flex";
        }
      });

      minimizeButton.textContent = state.isMinimized ? "+" : "−";
    }, "#555", "30px");

    dom.toolbar.appendChild(minimizeButton);

    // Group buttons
    GROUPS.forEach(group => {
      if (group?.trim()) {
        const groupButton = createButton(`Load ${group}`, 
          () => loadStudentsFromFile(group), "#042ad1");
        dom.toolbar.appendChild(groupButton);
      }
    });

    // Navigation buttons
    dom.prevButton = createButton("⬅ Prev", prevStudent, "#f39c12");
    dom.nextButton = createButton("➡ Next", fillNextStudent, "#4CAF50");
    const resetButton = createButton("Reset", () => {
      state.index = 0;
      fillNextStudent(false);
    }, "#e74c3c");

    // Skip checkbox
    const skipWrapper = document.createElement("label");
    Object.assign(skipWrapper.style, {
      display: "flex",
      alignItems: "center",
      gap: "4px",
      color: "white",
      fontSize: "12px",
      cursor: "pointer"
    });

    dom.skipCheckbox = document.createElement("input");
    dom.skipCheckbox.type = "checkbox";
    skipWrapper.appendChild(dom.skipCheckbox);
    skipWrapper.appendChild(document.createTextNode("Auto-skip graded"));

    dom.autoGradeZeros = document.createElement("input");
    dom.autoGradeZeros.type = "checkbox";
    skipWrapper.appendChild(dom.autoGradeZeros);
    skipWrapper.appendChild(document.createTextNode("Auto-grade zeros"));

    // Status display
    dom.status = document.createElement("span");
    Object.assign(dom.status.style, {
      marginLeft: "10px",
      fontWeight: "bold",
      color: "white",
      cursor: "pointer",
      padding: "4px 8px",
      borderRadius: "4px",
      backgroundColor: "rgba(255,255,255,0.1)",
      transition: "background-color 0.2s"
    });

    dom.status.textContent = "Student 0/0";
    dom.status.addEventListener("click", showJumpPopup);
    dom.status.addEventListener("mouseenter", () => {
      dom.status.style.backgroundColor = "rgba(255,255,255,0.2)";
    });
    dom.status.addEventListener("mouseleave", () => {
      dom.status.style.backgroundColor = "rgba(255,255,255,0.1)";
    });

    // Append all elements
    dom.toolbar.appendChild(dom.prevButton);
    dom.toolbar.appendChild(dom.nextButton);
    dom.toolbar.appendChild(resetButton);
    dom.toolbar.appendChild(skipWrapper);
    dom.toolbar.appendChild(dom.status);

    document.body.insertBefore(dom.toolbar, document.body.firstChild);
    updateStatus();
  }

  /**
   * Setup keyboard shortcuts
   */
  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        switch (e.key) {
          case "=":
          case "+":
            e.preventDefault();
            fillNextStudent();
            break;
          case "-":
            e.preventDefault();
            prevStudent();
            break;
          case "j":
            e.preventDefault();
            showJumpPopup();
            break;
        }
      }
    });
  }

  /**
   * Initialize script
   */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initializeToolbar();
        setupKeyboardShortcuts();
      });
    } else {
      initializeToolbar();
      setupKeyboardShortcuts();
    }
  }

  init();
})();