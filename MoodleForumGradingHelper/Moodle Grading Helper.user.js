// ==UserScript==
// @name         Moodle Grading Helper Enhanced
// @description  Adds a button to cycle through student names and fill the search box automatically in Moodle
// @match        https://moodle-courses2527.wolfware.ncsu.edu/mod/forum/*
// @version      2.0
// ==/UserScript==

(() => {
  'use strict';

  const TOOLBAR_CLASS = "abes-super-grader-toolbar";
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const FULL_NAME_COL = 0;
  const GROUP_COL = 5;
  const GROUPS = ["A", "B", "C"];

  let fileString = "";
  let students = [];
  let index = 0;
  let isTransitioning = false;
  let isMinimized = false;

  // DOM elements
  let toolbar, status, nextButton, prevButton, skipCheckbox;

  /**
   * Check if file is older than 7 days
   */
  function isFileStale(file) {
    return (Date.now() - file.lastModified) > SEVEN_DAYS_MS;
  }

  /**
   * Remove middle names from full name
   */
  function removeMiddleName(fullName) {
    if (!fullName) { return ""; }

    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) { return fullName; } // No middle name

    // Return first and last name only
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }

  /**
   * Upload and read CSV file
   */
  function uploadCSV() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv";

      input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) { return reject("No file selected"); }

        if (isFileStale(file)) {
          alert("Grading roll is over 7 days old. Consider downloading a new roll to avoid stale data.");
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          fileString = event.target.result;
          resolve(fileString);
        };
        reader.onerror = reject;
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
      if (!fileString || fileString.trim() === "") {
        await uploadCSV();
      }

      const rows = fileString
        .trim()
        .split("\n")
        .map(line => line.split(",").map(cell => cell.trim()));

      // Filter by key (column 5 = group) and remove middle names
      students = rows
        .filter(cols => cols[GROUP_COL] && cols[GROUP_COL].toLowerCase() === key.toLowerCase())
        .map(cols => removeMiddleName(cols[FULL_NAME_COL]));

      index = 0;
      if (students.length > 0) {
        await openSearchToggle();
        await fillStudent(students[index]);
        await selectStudent();
      }

      alert(`Loaded ${students.length} students for group "${key}".`);
      updateStatus();
    } catch (err) {
      alert("Failed to load students: " + err);
    }
  }

  /**
   * Utility function to wait
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for DOM children to appear
   */
  function waitForChildren(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const parent = document.querySelector(selector);
      if (!parent) { return reject(new Error(`Parent not found: ${selector}`)); }

      if (parent.children.length === 1) {
        return resolve(parent);
      }

      const observer = new MutationObserver(() => {
        if (parent.children.length === 1) {
          observer.disconnect();
          resolve(parent);
        }
      });

      observer.observe(parent, { childList: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout: children not added to ${selector}`));
      }, timeout);
    });
  }

  /**
   * Check if current student is already graded
   */
  async function isGraded() {
    await sleep(2000);
    const statusElement = document.querySelector("h2[data-region='status-container']");
    if (!statusElement) { return false; }
    return !statusElement.innerText.toLowerCase().includes("not");
  }

  /**
   * Save the grading of the current student
   */
  async function saveStudentGrade() {
    const saveButton = document.querySelector("button[data-action='savegrade']");
    if (!saveButton) { alert("Could not locate the save button to save grade."); }

    saveButton.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window
      }));
    await sleep(500);
  }

  /**
   * Open search toggle
   */
  async function openSearchToggle() {
    const toggle = document.querySelector("button.toggle-search-button");
    if (!toggle) { return; }

    toggle.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window
    }));
    await sleep(50);
  }

  /**
   * Fill student name in search bar
   */
  async function fillStudent(name) {
    const searchBar = document.querySelector("input[data-region='user-search-input']");
    if (!searchBar) { return; }

    searchBar.value = name;
    searchBar.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(50);
  }

  /**
   * Select student from search results
   */
  async function selectStudent() {
    try {
      await waitForChildren("div[data-region='search-results-container']", 5000);
      await sleep(1000);

      const studentButtons = document.querySelectorAll("button[data-action='select-user']");

      if (!studentButtons || studentButtons.length === 0) {
        alert("No students found in search results!");
        updateStatus();
        return;
      }

      if (studentButtons.length > 1) {
        alert("More than 1 possible student. Select yourself.");
        updateStatus();
        return;
      }

      studentButtons[0].dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window
      }));

      updateStatus();
    } catch (err) {
      console.error("Error selecting student:", err);
    }
  }

  /**
   * Navigate to next student
   */
  async function fillNextStudent(saveGrade = true) {
    if (isTransitioning) { return; }
    isTransitioning = true;

    if (saveGrade) { await saveStudentGrade(); }

    while (index < students.length) {
      await openSearchToggle();
      await fillStudent(students[index]);
      await selectStudent();

      if (skipCheckbox.checked) {
        const graded = await isGraded();
        if (graded) {
          index++;
          continue;
        }
      }

      index++;
      break;
    }

    if (index >= students.length) {
      alert("All students graded");
    }

    isTransitioning = false;
  }

  /**
   * Navigate to previous student
   */
  async function prevStudent() {
    if (index > 1) {
      index -= 2;
      await fillNextStudent();
    } else {
      alert("Already at first student");
    }
  }

  /**
   * Jump to specific student by number
   */
  async function jumpToStudent() {
    const targetNumber = prompt(`Enter student number (1-${students.length}):`);
    if (!targetNumber) { return; }

    const targetIndex = parseInt(targetNumber) - 1;

    if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= students.length) {
      alert(`Invalid student number. Please enter a number between 1 and ${students.length}.`);
      return;
    }

    index = targetIndex;
    await fillNextStudent();
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
      "text-align": "center"
    });

    btn.addEventListener("click", onClick);
    return btn;
  }

  /**
   * Update status display
   */
  function updateStatus() {
    status.textContent = `Student ${Math.min(index + 1, students.length)}/${students.length}`;
    status.title = "Click to jump to specific student";

    if (nextButton) {
      nextButton.title = students[index+1] || "No more students";
    }
    if (prevButton) {
      prevButton.title = students[Math.max(index - 1, 0)] || "At first student";
    }
  }

  /**
   * Initialize toolbar
   */
  function initializeToolbar() {
    // Remove existing toolbar if present
    const existingToolbar = document.querySelector(`.${TOOLBAR_CLASS}`);
    if (existingToolbar) {
      existingToolbar.remove();
    }

    // Create toolbar
    toolbar = document.createElement("div");
    toolbar.classList.add(TOOLBAR_CLASS);

    Object.assign(toolbar.style, {
      position: "fixed",
      top: "0",
      left: "0",
      background: "#333",
      color: "white",
      padding: "8px 20px",
      display: "flex",
      gap: "10px",
      alignItems: "center",
      zIndex: "9999",
      fontFamily: "sans-serif",
      fontSize: "14px",
      boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
    });

    // Add margin to body
    document.body.style.marginTop = "60px";

    // Create minimize button
    const minimizeButton = createButton("-", () => {
      isMinimized = !isMinimized;
      const children = toolbar.querySelectorAll("button, span, label");

      children.forEach(el => {
        if (el !== minimizeButton) {
          el.style.display = isMinimized ? "none" : "flex";
        }
      });

      minimizeButton.textContent = isMinimized ? "+" : "-";
    }, "#555", "30px");

    // Add the minimize button early so it's before the group buttons
    toolbar.appendChild(minimizeButton);

    // Create the group buttons
    GROUPS.forEach(group => {
      if (!group.trim() || group.trim() === "") { return; }
      const groupButton = createButton(`Load ${group}`, () => loadStudentsFromFile(group), "#042ad1");
      toolbar.appendChild(groupButton);
    });

    prevButton = createButton("⬅ Prev", prevStudent, "#f39c12");
    nextButton = createButton("➡ Next", fillNextStudent, "#4CAF50");
    const resetButton = createButton("Reset", () => {
      index = 0;
      fillNextStudent();
    }, "#e74c3c");

    // Create skip checkbox
    const skipWrapper = document.createElement("label");
    Object.assign(skipWrapper.style, {
      display: "flex",
      alignItems: "center",
      gap: "4px",
      color: "white",
      fontSize: "12px",
      cursor: "pointer"
    });

    skipCheckbox = document.createElement("input");
    skipCheckbox.type = "checkbox";

    const skipText = document.createTextNode("Auto-skip graded");
    skipWrapper.appendChild(skipCheckbox);
    skipWrapper.appendChild(skipText);

    // Create clickable status
    status = document.createElement("span");
    Object.assign(status.style, {
      marginLeft: "10px",
      fontWeight: "bold",
      color: "white",
      cursor: "pointer",
      padding: "4px 8px",
      borderRadius: "4px",
      backgroundColor: "rgba(255,255,255,0.1)"
    });

    status.addEventListener("click", jumpToStudent);
    status.textContent = "Student 0/0";

    // Add hover effect to status
    status.addEventListener("mouseenter", () => {
      status.style.backgroundColor = "rgba(255,255,255,0.2)";
    });
    status.addEventListener("mouseleave", () => {
      status.style.backgroundColor = "rgba(255,255,255,0.1)";
    });

    toolbar.appendChild(prevButton);
    toolbar.appendChild(nextButton);
    toolbar.appendChild(resetButton);
    toolbar.appendChild(skipWrapper);
    toolbar.appendChild(status);

    // Insert toolbar
    document.body.insertBefore(toolbar, document.body.firstChild);

    updateStatus();
  }

  /**
   * Setup keyboard shortcuts
   */
  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.altKey) {
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
            jumpToStudent();
            break;
        }
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeToolbar();
      setupKeyboardShortcuts();
    });
  } else {
    initializeToolbar();
    setupKeyboardShortcuts();
  }
})();