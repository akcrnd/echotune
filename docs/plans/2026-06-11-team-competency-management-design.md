# Team Competency Management Design

## Goal

Replace the legacy team Excel workbook with an app-managed team competency module. The module should keep the workbook's operating intent, but improve daily usability: team-based navigation, readable summaries, inline editing, linked employees, and clear evaluation progress.

## Source Workbook Shape

The reference file `시험시작팀.xls` contains these relevant sheets:

- Cover and approval metadata.
- Team organization and responsibility assignment.
- Team work classification.
- Required standards and member evaluation matrix.
- Required legal/company qualifications and holders.

## Recommended Product Shape

Add a new `팀 적격성 관리` menu. The page is organized by team and year, then shows four operational tabs:

- `조직 및 업무분장`: role group, employee, responsibility, deputy.
- `업무분류`: major category, core functions, control items, related docs, cooperating team/work.
- `요구기준 및 평가`: requirement rows with major/sub work, education, major, certification, experience, training, language, role-level standards, minimum level, and per-member scores.
- `요구자격 및 보유자`: required qualification, grade, holders, held qualification, plan, remarks.

## Data Model

Use normalized Postgres tables:

- `team_competency_reports`: team, year, revision, summary, approval/status metadata.
- `team_role_assignments`: report-specific organization and responsibility rows.
- `team_work_categories`: work classification rows.
- `team_competency_requirements`: required competency criteria rows.
- `team_competency_scores`: member scores per requirement.
- `team_required_qualifications`: legal/company qualification holder rows.

This keeps the module queryable and reportable while preserving the Excel sections.

## API Shape

The first implementation uses a practical report API:

- List teams and existing reports.
- Ensure or create a team/year report.
- Fetch a report with all nested rows.
- Save a report detail payload in one transaction.

This makes inline editing simple and avoids partial-save drift between related sections.

## UI Principles

- Favor dense, spreadsheet-like tables where they help comparison.
- Add summary cards for row counts, evaluated members, score completion, and qualification gaps.
- Keep controls predictable: team/year selectors, tabs, add-row buttons, save button.
- Show missing data as actionable empty states rather than blank sheets.

## Enterprise Rework Rules

After field review, the module must not behave like a blank workbook editor.

- Employee name, employee number, position, manager, and organization order come from `employees.manager_id` and are read-only here.
- Team competency can edit responsibility assignments, deputies, competency criteria, scores, qualification plans, and remarks.
- Existing or newly created reports are auto-repaired with the reference competency template when key sections are empty.
- Score matrices are generated from the current team roster and requirement list.
- Qualification tabs show evidence gaps when certification, skill, language, and training records are not yet registered.
- Organization order follows the org chart hierarchy; manual row ordering belongs in the org chart/personnel domain, not this report.

## Verification

Minimum verification:

- Database schema bootstraps on app start.
- API can create/fetch/save a report.
- UI renders for an existing team and can save edited rows.
- Production build succeeds.
