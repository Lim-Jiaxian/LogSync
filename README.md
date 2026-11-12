
# Equipment Tracker – SPARK Hackathon 2026 Write-up

## **Problem Statement**
\
At a fire station, no single place shows where each piece of equipment is or why it is missing from an appliance. Three rotas share the same appliances, so when an item is not where it should be, officers ask around to find out whether it is faulty, out for servicing, on loan to another station, borrowed from another unit, or lost. Loans to and from other units are tracked through [how loans are tracked today, e.g. messages or notes].
Sending equipment for servicing means filling in a 15-field online form, which the form itself estimates at 5 minutes, and nothing tracks the item afterwards. The daily handover and takeover (HOTO) check of each appliance depends on memory and on what the previous rota says. The result is time lost to questions, repeated forms, and items that are missing or overdue without anyone noticing.

## **What the App Is For**
\
LogSync is one app that gives every rota the same, current picture of the station's equipment. It joins three things that are handled separately today around one shared record for each item:

- **HOTO checklist:**  the daily handover check of each appliance, with notes on what to check for each item.
- **Equipment tracker:** every item at the station with its status and history, including servicing and loans to and from other units.
\

The modules are linked. A problem found at handover updates the item's status, and a servicing request or loan explains why an item is missing from an appliance.

## When the App Should Be Used
- **Every handover:** the outgoing and incoming officers work through the appliance's checklist, with each item's check notes in front of them. This also helps new firefighters learn what to check.
- **When something is faulty or missing:** the officer sends it for servicing directly from the checklist, or reports it missing.
- **When lending or borrowing equipment:** the units involved record the loan and its due date.
- **Whenever anyone asks "where is it?":** a single search shows the item's status, location and history.

## How the App Works
The minimum viable product has three modules built on one equipment record:
- **HOTO Checklist:** each appliance has a checklist approved by a designated officer, with a note on what to check for each item. At handover, officers mark each item ok, missing, faulty or wrong quantity. Items that are away for a known reason, such as servicing or a loan, show that reason instead of looking missing. Every row has a Send for servicing action, which opens a prefilled request on the same page.
- **Equipment Tracker:** every item has one record with its identifiers, current status (operational, spare, faulty, pending servicing, out for servicing, missing, lost or damaged, retired) and a full history of who changed it and when. Servicing requests carry the same information as the current form, mostly filled in automatically from the equipment record and the officer's profile. Loans to and from other units are confirmed on both sides and flagged when overdue.

## What changes for the user:
Situation
- Fault found at handover
- Item is out for servicing
- Equipment lent or borrowed

What happens in the app
- One tap on the checklist row opens a prefilled request. The item's status updates for everyone
- Its status and days away are visible to all rotas, on the appliance it came from
- Both units confirm handover and return, with a due date

What people no longer need to do
- Fill in the full form separately and tell the next rota
- Ask around why it is missing
- Rely on memory to chase it back

## Data and Security
The prototype runs on fictional stations, officers and equipment only, and the demo data is labelled as fake. It does not connect to any real SCDF or government system. A real deployment would need SCDF-approved infrastructure and a security review.

- **Roles:** firefighter, checklist approver, station logistics, senior read-only and admin, enforced on the server.
- **Accountability:** every status change records who made it, when, and why. Checklist and roster edits are logged.
- **Servicing:** requests can be exported in the current form's layout. The app does not submit anything to the servicing unit by itself, since that would need its agreement.
- **Approvals:** the equipment list, the servicing process and the hosting would need to be agreed with the units that own them before a pilot.

## Future Modules
These are not needed to prove the core idea, but would strengthen it once the core is validated:
- **Spare assignment:** when an item goes for servicing, assign a spare to the appliance from the station's stock.
- **Push notifications:** alerts on phones outside the app.
- **Fault analytics:** use the fault keywords to show which equipment fails most often.
- **System integration:** link to the servicing unit and existing logistics records so data is entered once.
- **Division roll-out:** extend to other stations, with loans visible across them.

## Conclusion
LogSync gives all rotas one place to see where every piece of equipment is and why. A servicing request that needed 15 fields now needs from the officer, and an item that goes missing from an appliance explains itself instead of prompting a round of questions. Faults found at handover reach servicing the same day, and loans no longer depend on memory. [Add measured figures, such as time per request and number of "where is it?" questions per week.]
By replacing scattered records with one shared, accountable record, the app supports SCDF's goals of leaner internal operations and a more ready response.

