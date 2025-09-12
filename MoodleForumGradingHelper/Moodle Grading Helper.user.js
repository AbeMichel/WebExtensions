// ==UserScript==
// @name Moodle Grading Helper
// @description Adds a button to cycle through student names and fill the search box automatically in Moodle
// @match            https://moodle-courses2527.wolfware.ncsu.edu/mod/forum/*
//
// @version          1.0
// ==/UserScript==

(() => {
  'use strict';

	const toolbarClass = "abes-super-grader-toolbar";
  let fileString = "";
  let students = [];

  let index = 0;
  let isTransistioning = false;
  let isMinimized = false;

  function isFile7DaysStale(file){
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return (now - file.lastModified) > sevenDaysInMs;
  }

  function uploadCSV() {
    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv";
        input.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) { return reject("No file selected"); }
						
          	// Check if the file is over 7 days old
          	if (isFile7DaysStale(file)) { alert("Grading roll is over 7 days old. Consider downloading a new roll to avoid stale data."); }

          	const reader = new FileReader();
            reader.onload = (event) => {
                fileString = event.target.result;
                resolve(fileString);
            };
            reader.onerror = (err) => reject(err);
            reader.readAsText(file);
        });
        input.click();
    });
}

  async function loadStudentsFromFile(key) {
    try {
      if (!fileString || fileString.trim() === "") { await uploadCSV(); }
      const text = fileString;
      // Expecting format: "Full Name,Group" per line
      const rows = text
        .trim()
        .split("\n")
        .map(line => line.split(",").map(cell => cell.trim()));

      // Filter by key (column 6 = group)
      students = rows
        .filter(cols => cols[5] && cols[5].toLowerCase() === key.toLowerCase())
        .map(cols => cols[0]);

      index = 0; // reset index
      if (students.length > 0) { await fillNextStudent(); }
      alert(`Loaded ${students.length} students for group "${key}".`);
      updateStatus();
    } catch (err) {
      alert("Failed to load students: " + err);
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function waitForChildren(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const parent = document.querySelector(selector);
        if (!parent) { return reject(new Error("Parent not found: " + selector)); }

        // If children are already present, resolve immediately
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

  async function isGraded() {
    await sleep(2000);
    const status = document.querySelector("h2[data-region='status-container']");
    if (!status) { return false; } // or throw an error if you prefer
    return !status.innerText.toLowerCase().includes("not");
	}

  async function openSearchToggle(){
    const toggle = document.querySelector("button.toggle-search-button");
    const mouseClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window
    });
    toggle.dispatchEvent(mouseClick);
    await sleep(50);
  }

  async function fillStudent(name){
    const searchBar = document.querySelector("input[data-region='user-search-input']");
		searchBar.value = name;
    searchBar.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(50);
  }

  async function selectStudent(){
    await waitForChildren("div[data-region='search-results-container']", 5000);
    await sleep(1000);
    const studentButtons = document.querySelectorAll("button[data-action='select-user']");

    if (!studentButtons || studentButtons.length === 0) {
        alert("No students found in search results!");
      	updateStatus();
        return;
    }

    // 🔹 Select the next button based on index
    if (studentButtons.length > 1) {
        alert("More than 1 possible student. Select yourself.");
      	index++;
      	updateStatus();
        return;
    }

    const nextButton = studentButtons[0];
    const mouseClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window
    });
    nextButton.dispatchEvent(mouseClick);
    updateStatus();
  }

  async function fillNextStudent(){
    if (isTransistioning) { return; }
    isTransistioning = true;

    while (index < students.length){
      await openSearchToggle();
      await fillStudent(students[index]);
      await selectStudent();

      if (skipCheckbox.checked){
        const graded = await isGraded();
        if (graded){
          index++;
          continue;
        }
      }

      index++;
      break;
    }
    if (index >= students.length){
      alert("All students graded");
    }
    isTransistioning = false;
  }

  async function prevStudent() {
    if (index > 1) {
      index -= 2; // step back one (since fillNextStudent will increment)
      await fillNextStudent();
    } else {
      alert("Already at first student");
    }
  }

  let toolbar = document.querySelector("." + toolbarClass);

  	if (!toolbar){
  		toolbar = document.createElement("div");
      toolbar.classList.add(toolbarClass);
    }
		toolbar.innerHTML = "";
  	
    Object.assign(toolbar.style, {
        position: "fixed",
//         width: "100%",
//       	height: "50px",
        background: "#333",
        color: "white",
        padding: "8px 20px",
        display: "flex",
        gap: "10px",
        alignItems: "center",
        zIndex: 9999,
        fontFamily: "sans-serif",
        fontSize: "14px",
      	top: "0",
      	left: "0"
    });

  	document.body.style.marginTop = "60px";

  	const status = document.createElement("span");
    status.style.marginLeft = "10px";
    status.style.fontWeight = "bold";
    status.style.color = "white";
    status.textContent = `Student 0/0`; // initial value

    // 🔹 Add buttons
    function makeButton(label, onClick, bg = "#4CAF50") {
        const btn = document.createElement("button");
        btn.textContent = label;
        Object.assign(btn.style, {
            padding: "6px 12px",
          	width: "75px",
          	height: "30px",
            background: bg,
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
        });
        btn.addEventListener("click", onClick);
        return btn;
    }

    // Create buttons
    const loadAButton = makeButton("Load A", () => loadStudentsFromFile("A"));
    const loadBButton = makeButton("Load B", () => loadStudentsFromFile("B"));
    const loadCButton = makeButton("Load C", () => loadStudentsFromFile("C"));
    const prevButton = makeButton("⬅ Prev", prevStudent, "#f39c12");
    const nextButton = makeButton("➡ Next", fillNextStudent, "#4CAF50");
    const resetButton = makeButton("Reset", () => { index = 0; fillNextStudent(); }, "#e74c3c");

  	const minimizeButton = document.createElement("button");
  	minimizeButton.textContent = "-";
  	Object.assign(minimizeButton.style, {
      padding: "6px 12px",
      width: "30px",
      height: "30px",
      background: "#555",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer"
    });

  	minimizeButton.addEventListener("click", () => {
      isMinimized = !isMinimized;
      const children = toolbar.querySelectorAll("button, span, label"); // all buttons + status + skip wrapper
      children.forEach(el => {
        if (el !== minimizeButton) { el.style.display = isMinimized ? "none" : "inline-block"; }
      });
//       toolbar.style.height = isMinimized ? "10px" : "30px";
    });
    toolbar.appendChild(minimizeButton);


    // Create the checkbox wrapper
    const skipWrapper = document.createElement("label");
    skipWrapper.style.display = "flex";
    skipWrapper.style.alignItems = "center";
    skipWrapper.style.gap = "4px";
    skipWrapper.style.color = "white";
    skipWrapper.style.fontSize = "12px";

    // Checkbox input
    const skipCheckbox = document.createElement("input");
    skipCheckbox.type = "checkbox";

    // Label text
    const skipText = document.createTextNode("Auto-skip graded");

    // Append
    skipWrapper.appendChild(skipCheckbox);
    skipWrapper.appendChild(skipText);

    // Append buttons and status
    toolbar.appendChild(loadAButton);
    toolbar.appendChild(loadBButton);
    toolbar.appendChild(loadCButton);
    toolbar.appendChild(prevButton);
    toolbar.appendChild(nextButton);
    toolbar.appendChild(resetButton);
  	toolbar.appendChild(skipWrapper);
    toolbar.appendChild(status);

    // Update status initially
    function updateStatus() {
        status.textContent = `Student ${Math.min(index + 1, students.length)}/${students.length}`;
        nextButton.title = students[index] || "No more students";
        prevButton.title = students[Math.max(index - 1, 0)] || "At first student";
      }
    updateStatus();

    document.body.insertBefore(toolbar, document.body.firstChild);

    // 🔹 Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
        if (e.altKey && (e.key === "=" || e.code === "Equal")) {
            e.preventDefault();
            fillNextStudent();
        }
        if (e.altKey && (e.key === "-" || e.code === "Minus")) {
            e.preventDefault();
            prevStudent();
        }

    });
})();