# Moodle Grading Helper

**Version:** 3.0  

**Author:** Abraham Michel (ajmiche2@ncsu.edu)

**Description:**  
This userscript adds a fixed toolbar to the Moodle forum grading page. It helps instructors and TAs grade forums by letting them load a student roll and automatically cycle through students, filling the Moodle search box with the next student's name and handling some of the repetitive actions.

---

## Installation

1. Install a userscript manager in your browser:
   - [FireMonkey](https://erosman.github.io/firemonkey/) (Developed with this)
   - Tampermonkey (Popular alternative)
   - Violentmonkey (Popular alternative)

2. **Create a new userscript** in your manager.

3. **Copy and paste** the entire content of `Moodle Grading Helper` script into the new userscript.

4. **Save and enable** the script.  

5. Navigate to your NCSU Moodle forum page

---

## Usage

0. **Configuration**
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
   - **GROUPS**: The possible group IDs you want to be able to search for. Will create corresponding **load** buttons on the toolbar.

1. **Load Student List**  
   - Click `Grade Users` on Moodle.
   - Click **Load [Group]** to select a grading group. 
      - *Note:* If no roll has been uploaded then it will prompt you to upload a CSV file for the entire roll.
      - *Note:* If the CSV is older than 7 days, you will be asked to provide a more up-to-date file.

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
   - Check this box to automatically skip over students who already have a recorded grade in Moodle.
5. **Auto-grade zeros**  
   - Check this box to automatically assign a 0 and save the grade for students who have no posts in the forum discussion.

6. **Minimize Toolbar**  
   - Click the **Minimize button (–)** to collapse the toolbar and reduce screen clutter. Click it again (**+**) to expand.

7. **Status Display**  
   - Shows the current student index and total students (`Student X/Y`).
   - Click to be prompted to jump to a specific student number or name.
   - Hover over the next/previous buttons to see the name of the corresponding student.

---

## CSV File Notes

- Must be a CSV format file.
- Must contain a Full Name column and a Group Letter column at the indices defined in the script's configuration.
- The entire file is read only upon upload for the current session.

---

## Troubleshooting

- **Toolbar Missing:** Check that the userscript is enabled and your browser is on a URL that matches the script's @match pattern.

- **Student Not Found:** The script automatically attempts to find students using their full name, then first and last name, then first name only. If it fails all attempts, an alert will appear.

- **Students not loading:** Ensure the CSV file is not empty and that the configured GROUP_COL and GROUPS values correctly match the data in your CSV.

---

## License

 [MIT License](../LICENSE)