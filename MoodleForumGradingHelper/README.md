# Moodle Grading Helper

**Version:** 1.0  
**Author:** Abraham Michel 
**Description:**  
A userscript that adds a toolbar to Moodle forums, allowing instructors and TAs to quickly cycle through student names and automatically fill the search box. It supports loading student lists from a CSV, skipping already-graded students, and tracking grading progress.

---

## Features

- Toolbar with buttons to:
  - Load student groups from csv files (A, B, C)
  - Navigate to previous/next student of the group
  - Reset to the first student in the group
  - Minimize the toolbar to reduce obstruction
- Status display: shows `Student X/Y` of current progress
- Tooltip on buttons showing the name of the next/previous student
- Auto-skip graded students (optional checkbox)
- Checks if uploaded CSV file is more than 7 days old

---

## Installation

1. Install a userscript manager in your browser:
   - [FireMonkey](https://erosman.github.io/firemonkey/) (Originally developed with this)
   - [Tampermonkey](https://www.tampermonkey.net/) (Popular alternative)
   - [Violentmonkey](https://violentmonkey.github.io/) (Popular alternative)

2. Create a new userscript in your manager.

3. Copy the entire content of `Moodle Grading Helper` script into the new userscript.

4. Save and enable the script.  

5. Navigate to your NCSU Moodle forum page 

---

## Usage

1. **Load Student List**  
   - Click **Load A**, **Load B**, or **Load C** to upload a CSV file for that group.
   - CSV format should have at least 6 columns, with:
     - Column 1: Full Name
     - Column 6: Group letter (A, B, or C)
   - Example row:  
     ```
     John Doe,12345,OtherData,OtherData,OtherData,A
     ```
   - If the CSV is older than 7 days, the script alerts you.

2. **Navigate Students**  
   - Click **➡ Next** to fill the next student in the search box.  
   - Click **⬅ Prev** to go back to the previous student.  
   - Keyboard shortcuts:  
     - `Alt + =` → Next student  
     - `Alt + -` → Previous student

3. **Reset**  
   - Click **Reset** to start from the first student.

4. **Auto-skip graded students**  
   - Enable the checkbox `Auto-skip graded` to automatically skip students whose status shows as graded.

5. **Minimize Toolbar**  
   - Click the `-` button to collapse the toolbar and reduce screen obstruction. Click again to expand.

6. **Status Display**  
   - Shows the current student index and total students (`Student X/Y`).
   - Hover over the next/previous buttons to see the name of the corresponding student.

---

## CSV File Notes

- Must be UTF-8 encoded.
- Must include at least 6 columns; the script uses column 1 for names and column 6 for group letters.
- The script only reads the uploaded CSV in the current session. Users must upload it each time they open the forum page.

---

## Troubleshooting

- **Toolbar doesn’t appear:** Ensure the script is enabled in your userscript manager and you are on a matching Moodle forum URL.
- **CSV not loading:** Confirm the CSV has the correct format and you selected the right file when prompted.
- **Skipping graded students not working:** Ensure the grading status is correctly displayed in Moodle (`h2[data-region='status-container']`) and that the checkbox is checked.
- **All students skipped / None loaded:** Check that the group letter in the CSV is either `A`, `B`, or `C` non-case sensitive.

---

## License

 
