# Moodle Grading Helper

**Version:** 2.0  
**Author:** Abraham Michel 
**Description:**  
A userscript that adds a toolbar to Moodle forums, allowing instructors and TAs to quickly cycle through student names and automatically fill the search box. It supports loading student lists from a CSV, skipping already-graded students, and tracking grading progress.

---

## Features

- Toolbar with buttons to:
  - Load student groups from csv files
  - Navigate to previous/next student of the group
  - Reset to the first student in the group
  - Minimize the toolbar to reduce obstruction
  - Search for students based on their number in the roll or name
- Status display: shows `Student X/Y` of current progress
- Tooltip on buttons showing the name of the next/previous student
- Auto-skip graded students (optional checkbox) (WIP)
- Checks if uploaded CSV file is more than 7 days old

---

## Installation

1. Install a userscript manager in your browser:
   - [FireMonkey](https://erosman.github.io/firemonkey/) (Originally developed with this)
   - Tampermonkey (Popular alternative)
   - Violentmonkey (Popular alternative)

2. Create a new userscript in your manager.

3. Copy the entire content of `Moodle Grading Helper` script into the new userscript.

4. Save and enable the script.  

5. Navigate to your NCSU Moodle forum page 

---

## Usage

0. **Parameters**
      ```js
      // @match        https://moodle-courses2527.wolfware.ncsu.edu/mod/forum/*
      ```
      ```js
      const FULL_NAME_COL = 0;
      const GROUP_COL = 5;
      const GROUPS = ["A", "B", "C"];
      ```
   - **@match**: The target url for this script interface to appear.
   - **FULL_NAME_COL**: The column in the CSV where the students' full names appear. 0 indexed.
   - **GROUP_COL**: The column in the CSV where the students' group letters appear. 0 indexed.
   - **GROUPS**: The possible group IDs you want to be able to search for.



1. **Load Student List**  
   - Click **Load [Group]** to select a grading group. If no roll has been uploaded then it will prompt you to upload a CSV file for the entire roll.
   - CSV format should have at least 6 columns, with:
     - Column (defined above): Full Name
     - Column (defined above): Group letter (A, B, or C)
   - Example row:  
     ```
     John Doe,12345,OtherData,OtherData,OtherData,A
     ```
   - If the CSV is older than 7 days, you will be asked to provide a more up-to-date file.

2. **Navigate Students**  
   - Click **➡ Next** to go to the next student in the roll and group.  
   - Click **⬅ Prev** to go back to the previous student.  
   - Keyboard shortcuts:  
     - `Alt + =` → Next student  
     - `Alt + -` → Previous student
     - `Alt + J` → Jump to student

3. **Reset**  
   - Click **Reset** to start from the first student.

4. **Auto-skip graded students**  
   - Enable the checkbox `Auto-skip graded` to automatically skip students whose status shows as graded.

5. **Minimize Toolbar**  
   - Click the `-` button to collapse the toolbar and reduce screen obstruction. Click again to expand.

6. **Status Display**  
   - Shows the current student index and total students (`Student X/Y`).
   - Click to be prompted to jump to a specific student number or name.
   - Hover over the next/previous buttons to see the name of the corresponding student.

---

## CSV File Notes

- Must include at least 2 columns; the script uses one column for names and another column for group letters.
- The script only reads the uploaded CSV in the current session. Users must upload it each time they open the forum page.

---

## Troubleshooting

- **Toolbar doesn’t appear:** Ensure the script is enabled in your userscript manager and you are on a matching Moodle forum URL.
- **CSV not loading:** Confirm the CSV has the correct format and you selected the right file when prompted.
- **Skipping graded students not working:** Ensure the grading status is correctly displayed in Moodle (`h2[data-region='status-container']`) and that the checkbox is checked. **Not currently working.**
- **All students skipped / None loaded:** Check that the CSV isn't empty, the correct group and name columns are assigned, and that you have loaded a group.

---

## License

 [MIT License](../LICENSE)


## Changelog

**9/16/2025**
- Improved the auto search function to check for the full name, then the name without a middle name, and finally only the first name.

- Implemented functionality for searching students by name or by number in list.