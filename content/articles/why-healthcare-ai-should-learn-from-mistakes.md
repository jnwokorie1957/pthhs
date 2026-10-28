# Why Healthcare AI Should Learn From Mistakes: Lessons From Modernizing Home Care Operations

A home care office can spend considerable effort checking whether information agrees across a schedule, a visit record and an administrative dashboard. A missing entry may need attention. An outdated entry can be equally confusing, especially when it looks current.

For families, the important question is practical: can the agency coordinate support and explain what happens next? Technology should help staff answer that question without creating another source of uncertainty.

Primetime Home Health Services provides non-medical personal assistance services in Greater Houston and has served the community for more than 25 years. Its technology-modernization work offers a useful starting point for discussing responsible administrative AI: improve the information people rely on before expanding what software is allowed to do.

## Start with a specific problem

“Use AI” is too broad to guide a useful project. “Help an authorized staff member identify records that need review” gives the project a clearer purpose and a boundary.

Some tasks need ordinary software rules rather than AI. Checking whether a required field is empty is different from asking a language model to summarize a complicated note. A predictable rule may be easier to test, explain and maintain. When AI is proposed, the team should identify what it adds and how its mistakes will be caught.

A limited example from PTHHS's modernization work illustrates the distinction. Development work addressed how an administrative screen used an updated record association instead of retaining an outdated one. Automated checks supported that correction, but operational acceptance remained a separate step. This was a software-maintenance lesson, not evidence that AI improved care or made Medicaid decisions.

The broader lesson is straightforward: a polished display is useful only if it reflects the right information. Testing a correction and confirming that staff can safely use the resulting workflow are different responsibilities.

## Treat an exception as a question to investigate

Electronic Visit Verification, or EVV, is part of the administrative context for this discussion. A proposed review tool should help staff find information that needs checking, while leaving the organization's established processes in place. This article does not explain EVV rules or authorize changes to visit records.

An administrative tool could help organize exceptions for authorized review. Its labels should avoid turning incomplete information into a conclusion about a caregiver or client.

Consider a **hypothetical training example**, using invented records: a visit appears to lack an end time. The tool could flag the missing field and show when the source was last checked. It should not invent a time, accuse someone of missing a visit, change payroll or decide whether a claim is payable. A staff member needs to investigate through the approved workflow.

## A useful alert explains what to check next

An administrative alert should give the person reading it enough information to take a sensible next step. A label such as “Attention needed” leaves too much work unexplained.

For a proposed home care administrative tool, a useful message can answer four questions:

- **What was observed?** Name the missing information or the check that could not finish.
- **What information was available?** Identify the source and when it was last checked, where that context is relevant and permitted.

- **What remains uncertain?** Separate an incomplete check from a confirmed result.
- **What should the authorized reviewer do next?** Point to the established review process without making a consequential decision for them.

Consider a **hypothetical design example using invented information**. An office tool cannot refresh a routine administrative list. “No items need review” would be misleading if the tool never completed its check. A more useful message might say:

> The latest check could not finish. The list below was last refreshed at 9:00 a.m. today. Newer changes may be missing. Use the approved review process before relying on this list.

The timestamp here is an invented example, not a report from PTHHS. In an actual interface, the wording should match what the software can establish. If it does not know the last successful refresh time, it should say that rather than display an assumed time.

The same care applies when a reviewer takes action. Opening an item, reviewing it and resolving the underlying question are different events. A proposed tool should explain which event it has recorded. A message that says a review note was saved should not imply that the underlying information has been corrected.

## Make the message usable

Clear wording is only part of the job. W3C’s form guidance recommends concise feedback, understandable error descriptions and instructions for correcting problems. Applying that principle to administrative screens, an alert should name the relevant item or field and explain the next available step. [W3C User Notification](https://www.w3.org/WAI/tutorials/forms/notifications/)

People who use screen readers also need to know when relevant status information changes. W3C explains how status messages can be exposed to assistive technology without moving focus, while warning that excessive announcements can make an application too talkative. The appropriate behavior needs testing in the actual interface. [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

Before considering a message ready, try it with synthetic information and ask a reviewer to explain what happened, what remains unknown and what they would do next. Include an unavailable source and an older result, not just a successful refresh. If someone reasonably reads “nothing needs review” when the intended meaning is “we could not check,” revise the wording and behavior.

These checks evaluate communication. They do not establish that an entire administrative workflow is accepted for operational use. Clinical, eligibility, authorization, billing and payroll decisions remain outside this proposed alert’s purpose.

## Make “learning from mistakes” measurable

AI does not necessarily improve merely because someone points out an error. Improvement requires a deliberate process for reviewing the failure, changing the system and testing the change.

A small agency can begin with a controlled test set containing invented examples of incomplete records, duplicates and outdated information. Before considering operational use, ask:

- Did the tool find the issues the test was designed to contain?
- How often did it flag a record that did not need attention?
- Did it explain uncertainty instead of guessing?
- Could an authorized reviewer trace the result to its source?
- Did a correction create a new problem elsewhere?

These are proposed evaluation questions, not results reported by PTHHS. Record a baseline before claiming fewer mistakes or less administrative work. NIST's voluntary AI Risk Management Framework supports considering risk throughout AI design, use and evaluation. [NIST: AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)

## Keep private information and consequential decisions protected

Development experiments should use synthetic information wherever possible. Access to operational records should be limited to approved purposes and authorized people. Staff should follow their organization's established privacy and security procedures rather than placing private records into an unapproved tool.

Administrative assistance must not become an unreviewed route to clinical, eligibility, authorization, billing or payroll decisions. A proposed tool needs clear permissions, a documented review process and a way to stop or reverse a faulty change before it affects operations.

## What families should expect

For a family seeking non-medical home care in Houston, useful technology should support clear communication and dependable administrative follow-through. Families should still be able to ask a person about services, current availability and the next step.

Learn about [PTHHS personal care services](https://pthhs.net/home-care-services/personal-care), or [contact the agency](https://pthhs.net/home-care-contact-us) to discuss your needs. Services depend on applicable authorization and availability. This article provides general operational education, not individualized medical, legal or eligibility advice.
