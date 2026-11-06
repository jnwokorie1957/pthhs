import { createHash } from "node:crypto";

// Owner-requested digital reading editions of the blank duplex packet. Source
// images remain private for reconciliation; no completed records belong here.
// Paragraphs, lists and punctuation are reflowed; substantive terms are retained.
// HR/legal release gates remain closed, including the incomplete source pledge
// and emergency-policy receipt. Reading is not a medical or benefit election.
const documents: Record<number, string> = {
6: `Primetime Home Health Services, Inc. is required to conduct a criminal history check on all unlicensed applicants (providers, attendants, and Home Health Aids), whose duties will include direct contact with patients, patients' families, patient visitors or the property of such persons, in accordance with Health and Safety Code chapters 250 and 142. This is to ensure that persons caring for patients have no criminal history.

No person shall be hired with any positive history check in the items which bar employment or if they are listed in the registry as having a finding of misconduct. The agency will review any criminal conviction listed on the DPS report to determine if the conviction(s) meets the criteria as an automatic bar for employment.

Primetime Home Health Services, Inc. respects the right of choice our clients have in determining their attendants, especially relatives they feel comfortable to relate with. Sometimes clients insist that the agency hire their choice of attendant in spite of unfavorable criminal activities that may be committed by the attendant they recommended to the agency to hire to serve them while serving in that capacity.`,
8: `I, {{employee}}, have applied for employment with Primetime Home Health Services, Inc. and understand my duties involve direct contact with an agency consumer. I have informed the agency of all names (maiden, aliases) I have used in the past.

I understand I have been employed on an emergency basis and my employment is temporarily pending the results of a State of Texas criminal history check, search of nurse aide registry and the employee misconduct registry. If I have a criminal conviction, I am listed in the misconduct registry or have committed certain conduct that would bar me from employment with the Agency, I am aware my employment will be terminated immediately.

## Offenses listed in the notice
I have not been convicted of the following offenses:
- Chapter 19, Penal Code (criminal homicide)
- Chapter 20, Penal Code (kidnapping and false imprisonment)
- Section 21.11, Penal Code (indecency with a child)
- Section 22.011, Penal Code (sexual assault)
- Section 22.02, Penal Code (aggravated assault)
- Section 22.04, Penal Code (injury to a child, elderly individual or disabled individual)
- Section 22.041, Penal Code (abandoning or endangering a child)
- Section 22.08, Penal Code (aiding suicide)
- Section 25.031, Penal Code (agreement to abduct from custody)
- Section 25.08, Penal Code (sale or purchase of a child)
- Section 28.02, Penal Code (arson)
- Section 29.02, Penal Code (robbery)
- Section 29.03, Penal Code (aggravated robbery); or
- An offense that the facility determines to be a contraindication to employment with the consumers the agency serves.

A person convicted of an offense under Chapter 31, Penal Code (theft), that is punishable as a felony, may not be employed in a position of duties of which involve direct contact with a resident or consumer, unless the conviction is at least five years old. This automatic bar to employment applies to those employees first hired by the agency on or after September 1, 2001.

The agency will review any criminal conviction listed on the DPS report to determine if the conviction(s) meets the criteria as an automatic bar for employment.

## Agency review
If the agency believes a conviction may bar a person from employment in the agency, the agency will notify the applicant or employee. The notification will include a statement informing the person he may contact DPS to request an opportunity to be heard concerning the accuracy of the criminal history record information.

The agency will not hire an applicant for employment and will immediately discharge an employee if the agency:
1. Determines, because of a criminal history check, a person has been convicted of the automatic bars to employment;
1. Becomes informed of a person's conviction under the law of another state, federal law, or the Uniform Code of Military Justice for an offense containing elements that are substantially similar to the elements of the automatic bars to employment;
1. Determines that a person is listed in the nurse aide registry (established under the Omnibus Reconciliation Act of 1987) as unemployable due to findings of abuse, neglect or mistreatment of a consumer of any agency or facility licensed under Health and Safety Code, or misappropriation of a consumer's property; or
1. Determines a person is listed in the employee misconduct registry (established under Health and Safety Code, Chapter 253), as unemployable due to a finding the person has committed an act constituting reportable conduct.

The agency may request a criminal history conviction check on unlicensed employees at any time the agency determines appropriate.

The agency will request a criminal history check within 72 hours of employment.

I understand the criminal history records and the information they contain will not be released or otherwise disclosed to any person or entity other than myself, except on court order or my written consent.

I certify the information on this form contains no willful misrepresentation and the information given is true and complete to the best of my knowledge.`,
9: `The agency will respect the patient's right to confidentiality of personal and medical information. All employees will be provided with information during orientation regarding respect for the patient's privacy and confidentiality of information obtained by the employee during the provision of services and through contact with medical records. Medical records will be stored at the agency's office in file cabinets. All office and field-based employees will maintain confidentiality of medical information and records. Access to medical records will be limited. Records will not be removed from the office. The patient's/family's written consent will be required for the release of information not authorized by law.

A patient data sheet may be kept in the patient's home for the purpose of communication between all health care providers and family and for quick reference on the patient's status. Examples of items listed might include vital signs, glucose level, and concerns or problems. A patient's family member will be educated by the skilled nurse or therapist about the confidentiality of patient information and the need to protect it from loss or unauthorized use.

If the patient transfers to another home health agency, a transfer form will be utilized per policy. Prior to beginning employment, personnel will be requested to sign an Agreement of Confidentiality attesting to their understanding of an agreement to maintenance of confidentiality of all patient information.

## Employee agreement
I, {{employee}}, understand that in the performance of my duties, I may have contact with sensitive and confidential information about patients receiving services from the Agency. I will respect each patient's right to privacy and will hold in confidence any private or medical information of which I may become knowledgeable in carrying out my assigned duties.

I further understand that should I fail to honor confidential information about patients, other employees, or the agency, such breach of confidentiality may be cause for my termination of employment with the agency.`,
10: `I, the undersigned, have read and understand Primetime Home Health Services, Inc. Policy on confidentiality of Protected Personal Health Information. In consideration of my employment or association with terms and conditions of my employment or after my employment or association ends, access or use personal health information, or reveal or disclose to any person within or outside Primetime Home Health Services, Inc. any personal health information except as may be required in the course of my duties and responsibilities and in accordance with applicable legislation and corporate and department policies governing will result in disciplinary action up to and including termination of employment, contact or association and the imposition of fines pursuant to applicable state and federal laws.

## Administering individual's statement
I have discussed the Confidentiality Protected Personal Health Information Policy and the consequences of a breach with the above named.`,
12: `I, {{employee}}, have been provided with a copy of the agency Policy on emergency preparedness & policy and procedures, planning, and implementation that includes any pandemic such as COVID-19, and I understand my role in implementing that policy.`,
13: `I understand that this Addendum serves as a formal agreement between me and Primetime Home Health Services, Inc. concerning the handling of wage overpayments and misconduct that may result in financial liability to the Agency.

## Overpayments
I understand that an Overpayment includes, but is not limited to:
- Clerical or payroll errors resulting in excess wages.
- Billing errors tied to my work.
- Misconduct including but not limited to falsified time entries or EVV records, clocking in while not providing services (e.g., while hospitalized), or providing services not authorized under Medicaid, Agency policies, or payer rules (including a parent/guardian serving as a paid attendant for a minor child where prohibited).
- Any act resulting in the Agency being required to refund or repay claims to a payer, insurer, or government agency.

## Recovery
I acknowledge and agree that Primetime Home Health Services, Inc.:
- Has the right to recover the amount of any Overpayment.
- Is authorized to deduct Overpayments from my future wages, subject to applicable law.
- May require me to repay any remaining balance if I am no longer employed at the Agency.
- May pursue civil recovery, legal action, or referral to regulatory authorities if repayment is not made.

I have read, understood, and voluntarily agree to this Addendum as a condition of employment or continued employment. I further acknowledge that this Addendum applies to all wages paid on or after the date of my signature below and does not retroactively cover wages earned before that date.`,
14: `Bloodborne pathogens are infectious microorganisms present in blood that can cause disease in humans. These pathogens include, but are not limited to, hepatitis B virus (HBV), hepatitis C virus (HCV), and human immunodeficiency virus (HIV), the virus that causes AIDS. Workers exposed to bloodborne pathogens are at risk for serious or life-threatening illnesses.

## Protections provided by OSHA's Bloodborne Pathogens Standard
All of the requirements of OSHA's Bloodborne Pathogens standard can be found in Title 29 of the Code of Federal Regulations at 29 CFR 1910.1030. The standard's requirements state what employers must do to protect workers who are occupationally exposed to blood or other potentially infectious materials (OPIM), as defined in the standard. That is, the standard protects workers who can reasonably be anticipated to come into contact with blood or OPIM as a result of doing their job duties.

In general, the standard requires employers to:

## Establish an exposure control plan
This is a written plan to eliminate or minimize occupational exposures. The employer must prepare an exposure determination that contains a list of job classifications in which all workers have occupational exposure and a list of job classifications in which some workers have occupational exposure, along with a list of the tasks and procedures performed by those workers that result in their exposure.

## Update the plan annually
Employers must update the plan annually to reflect changes in tasks, procedures, and positions that affect occupational exposure, and also technological changes that eliminate or reduce occupational exposure. In addition, employers must annually document in the plan that they have considered and begun using appropriate, commercially available effective safer medical devices designed to eliminate or minimize occupational exposure. Employers must also document that they have solicited input from frontline workers in identifying, evaluating, and selecting effective engineering and work practice controls.

## Implement universal precautions
Treat all human blood and OPIM as if known to be infectious for bloodborne pathogens.

## Identify and use engineering controls
These are devices that isolate or remove the bloodborne pathogens hazard from the workplace. They include sharps disposal containers, self-sheathing needles, and safer medical devices, such as sharps with engineered sharps-injury protection and needleless systems.

## Identify and ensure the use of work practice controls
These are practices that reduce the possibility of exposure by changing the way a task is performed, such as appropriate practices for handling and disposing of contaminated sharps, handling specimens, handling laundry, and cleaning contaminated surfaces and items.

## Provide personal protective equipment (PPE)
Such as gloves, gowns, eye protection, and masks. Employers must clean, repair, and replace this equipment as needed. Provision, maintenance, repair and replacement are at no cost to the worker.

## Make hepatitis B vaccinations available
Make available hepatitis B vaccinations to all workers with occupational exposure. This vaccination must be offered after the worker has received the required bloodborne pathogens training and within 10 days of initial assignment to a job with occupational exposure.

## Make post-exposure evaluation and follow-up available
Make available post-exposure evaluation and follow-up to any occupationally exposed worker who experiences an exposure incident. An exposure incident is a specific eye, mouth, other mucous membrane, non-intact skin, or parenteral contact with blood or OPIM. This evaluation and follow-up must be at no cost to the worker and includes documenting the route(s) of exposure and the circumstances under which the exposure incident occurred; identifying and testing the source individual for HBV and HIV infectivity, if the source individual consents or the law does not require consent; collecting and testing the exposed worker's blood, if the worker consents; offering post-exposure prophylaxis; offering counseling; and evaluating reported illnesses. The healthcare professional will provide a limited written opinion to the employer and all diagnoses must remain confidential.

## Use labels and signs to communicate hazards
Warning labels must be affixed to containers of regulated waste; containers of contaminated reusable sharps; refrigerators and freezers containing blood or OPIM; other containers used to store, transport, or ship blood or OPIM; contaminated equipment that is being shipped or serviced; and bags or containers of contaminated laundry, except as provided in the standard. Facilities may use red bags or red containers instead of labels. In HIV and HBV research laboratories and production facilities, signs must be posted at all access doors when OPIM or infected animals are present in the work area or containment module.

## Provide information and training to workers
Employers must ensure that their workers receive regular training that covers all elements of the standard including, but not limited to: information on bloodborne pathogens and diseases, methods used to control occupational exposure, hepatitis B vaccine, and medical evaluation and post-exposure follow-up procedures. Employers must offer this training on initial assignment, at least annually thereafter, and when new or modified tasks or procedures affect a worker's occupational exposure. Also, HIV and HBV laboratory and production facility workers must receive specialized initial training, in addition to the training provided to all workers with occupational exposure. Workers must have the opportunity to ask the trainer questions. Also, training must be presented at an educational level and in a language that workers understand.

## Maintain worker medical and training records
The employer also must maintain a sharps injury log, unless it is exempt under Part 1904 - Recording and Reporting Occupational Injuries and Illnesses, in Title 29 of the Code of Federal Regulations.

## Additional information
For more information, go to OSHA's Bloodborne Pathogens and Needlestick Prevention Safety and Health Topics web page at: https://www.osha.gov/SLTC/bloodbornepathogens/index.html.

To file a complaint by phone, report an emergency, or get OSHA advice, assistance, or products, contact your nearest OSHA office under the U.S. Department of Labor listing in your phone book, or call toll-free at (800) 321-OSHA (6742).

This is one in a series of informational fact sheets highlighting OSHA programs, policies or standards. It does not impose any new compliance requirements. For a comprehensive list of compliance requirements of OSHA standards or regulations, refer to Title 29 of the Code of Federal Regulations. This information will be made available to sensory-impaired individuals upon request. The voice phone is (202) 693-1999; the teletypewriter (TTY) number is (877) 889-5627.

For assistance, contact us. We can help. It's confidential.

Occupational Safety and Health Administration. www.osha.gov. 1-800-321-6742. DSG 1/2011.`,
15: `I have read and understand the Agency's policy and procedure regarding the Hepatitis B Vaccination program. I understand that due to my occupational exposure to blood or other potentially infectious material, I may be at risk of acquiring the Hepatitis B virus (HBV) infection.

## Vaccination record statement
I have received the Hepatitis B vaccine series in the last 12 months.

Last date received: completed privately with the office.

## Declination statement
I decline the hepatitis B vaccination at this time. I understand that by declining this vaccine, I continue to be at risk of acquiring Hepatitis B, a serious disease. If in the future I continue to have occupational exposure to blood or other potentially infectious material and I want to be vaccinated with Hepatitis B vaccine, I can receive the vaccination series at no charge to me.`,
16: `Dear Employee,

Please note that our agency Primetime Home Health Services, Inc. does not contribute to the Texas Worker's Compensation pool. Care for any injury received while performing in your job capacity during working hours for the company shall be compensated for by the company.

I acknowledge that I have been duly informed that the company does not contribute to the Texas Worker's Compensation pool and injury suffered while providing services for the agency shall be covered and paid for by the agency.

Please contact your supervisor if you have any questions.`,
17: `I, {{employee}}, hereby acknowledge that my employer, Primetime Home Health Services, Inc., has offered me the opportunity to enroll in health coverage under a qualifying health insurance plan. I understand that I am entitled to participate in the plan as long as I continue to satisfy any eligibility requirements and continue to pay any required contributions, all in accordance with plan terms and state and federal law.

After due consideration, I hereby knowingly and voluntarily elect to ACCEPT or DECLINE this offer of coverage. I understand that I will not have another opportunity to enroll in coverage under the health plan until next open enrollment period.

## Election choices on the separate enrollment record
- Accept
- Decline. Please email a copy to irab@pthhs.net.`,
18: `Please be advised that effective January 2017, Primetime Home Health Services, Inc. will no longer be issuing payroll checks. Instead, your pay will be directly deposited into your bank account.

In accordance with this new payroll disbursement procedure, every employee is required to provide the Human Resources department within 7 days of application; you can email a copy to irab@pthhs.net:
- Void sample of a personal check.
- Form from the bank.
- Or you can purchase our prepaid card for a one-time fee of $10.00.

The implementation of Direct Payroll Deposits will greatly benefit all the employees of Primetime Home Health Services, Inc. and we thank you for your cooperation in helping to make this a smooth transition.`,
19: `## Topics of orientation
1. Job responsibilities.
1. Philosophy and values of community integration and consumer-driven care.
1. Reports of abuse, neglect and exploitation.
1. Personnel policies.
1. Agency philosophy and objectives.
1. Universal precautions / HIV and prevention and Hepatitis B.
1. Safety in the home.
1. Hours of business.
1. Payroll.
1. Patient's rights.
1. Emergency preparedness.

The orientation record includes the initials of the preceptor, initials of the employee and date of orientation for each topic, plus employee and supervisor signatures and dates. These are completed with the office following the actual orientation.`,
20: `Texas Health and Human Services Commission

Cecile Erwin Young, Executive Commissioner

Date: September 8, 2025

## To
- Assisted Living Facilities (ALF)
- Community Attendant Services (CAS)
- Community First Choice (CFC)
- Community Living Assistance and Support Services-Direct Service Agency (CLASS-DSA) waiver program
- Day Activity and Health Services (DAHS)
- Deaf Blind with Multiple Disabilities (DBMD) waiver program
- Family Care (FC)
- Home and Community-based Services (HCS) waiver program
- Home and Community-Based Services - Adult Mental Health Program (HCBS-AMH)
- Intermediate Care Facilities for Individuals with an Intellectual Disability or Related Conditions (ICF/IID)
- Financial Management Services Agencies (FMSAs)
- Local Intellectual and Developmental Disability Authorities (LIDDAs)
- Primary Home Care (PHC)
- Residential Care (RC)
- Texas Home Living (TxHmL)
- STAR Kids and STAR Health Medically Dependent Children's Program (MDCP)
- STAR Kids and STAR Health state plan services
- STAR+PLUS Home and Community-Based Services (HCBS) and Non-HCBS Providers

## Subject
Information Letter No. 2025-24 (Revised): Payment Rate Actions for Attendant Services in Various Programs, effective September 1, 2025. (Replaces IL 2025-17)

The Texas Health and Human Services Commission (HHSC) approved payment rates effective September 1, 2025, for personal attendant services provided in the following settings and programs:
- Assisted living facilities (ALF)
- Community Living Assistance and Support Services (CLASS) Waiver
- Community First Choice (CFC)
- Day Activity and Health Services (DAHS)
- Deaf Blind with Multiple Disabilities Waiver (DBMD)
- Home and Community-Based Services - Adult Mental Health Program (HCBS-AMH)
- Home and Community-Based Services Waiver (HCS)
- Intermediate Care Facilities for Individuals with an Intellectual Disability or Related Conditions (ICF/IID)
- Personal Care Services (PCS)
- Primary Home Care (PHC)
- Community Attendant Services (CAS)
- Family Care (FC)
- Residential Care (RC)
- STAR Kids and STAR Health Medically Dependent Children Program (MDCP)
- STAR Kids and STAR Health state plan services
- STAR+PLUS Home and Community-Based Services (HCBS) and Non-HCBS programs
- Texas Home Living Waiver (TxHmL)

More information about the approved payment rates is available on the HHSC Provider Finance Department webpage.

## Payment rates
HHSC approved payment rate increases in accordance with the 2026-27 General Appropriations Act, Senate Bill 1, 89th Legislature, Regular Session, 2025 (Article II, Rider 23), which:
- Increases the wage for attendants to an average of $13.00 per hour.
- Increases the associated payroll costs, taxes, and benefits percentage to 15 percent for services provided in residential settings and 14 percent for services provided in non-residential settings.
- Provides appropriations to increase the associated administrative rate for personal attendant services by $0.24 per attendant hour.

P.O. Box 13247, Austin, Texas 78711-3247. 512-424-6500. hhs.texas.gov.`,
21: `HHSC is responsible for the reimbursement determination functions for the Texas Medicaid program. Adopted rates are calculated using established methodologies that conform to the Social Security Act and related federal regulations, the federally approved Texas Medicaid state plan, all applicable state statutes and rules, and other requirements. Adopted rates are limited to available appropriations.

## Federal approval
As of August 28, 2025, HHSC has received approval from the Centers for Medicare & Medicaid Services (CMS) of amendments to the 1915(c) waiver applications to implement the changes discussed in this letter with the effective date of September 1, 2025. The waiver programs include CLASS, DBMD, HCS, TxHmL, and MDCP. Therefore, HHSC has implemented the proposed rates to be paid on September 1, 2025.

HHSC is still seeking approval for payment rates from CMS for the Medicaid state plan services listed above. All state plan amendments have been submitted to CMS with a September 1, 2025 effective date. Since state plan amendments can be retroactive, providers can begin billing and be reimbursed the new rates beginning September 1, 2025 for the following state plan services: ICF/IID services, DAHS, PHC, CAS, PCS, and CFC.

On August 29, 2025, HHSC received approval from CMS of an amendment to the 1915(i) state plan HCBS-AMH program to implement the changes discussed in this letter. Therefore, HHSC has implemented the proposed rates to be paid on September 1, 2025.

A Texas Healthcare Transformation and Quality Improvement Program section 1115(a) Medicaid demonstration waiver amendment was not needed to apply the rate changes to the STAR+PLUS program.

The approved payment rates can be accessed on the Provider Finance Department, Long-term Services & Supports website.

## Claims submission
The claims process will not change for services authorized in units; therefore, providers should continue to bill using their normal billing process. No further action is required from providers at this time.

HHSC has also published the following Information Letters regarding the individual plan of care and individual service plans for CLASS, DBMD, HCS and TxHmL providers:
- Deaf Blind with Multiple Disabilities IL 2025-22
- Community Living Assistance and Support Services IL 2025-23
- Home and Community-based Services IL 2025-21
- Texas Home Living IL 2025-19

## Resources
Please contact the HHSC PFD LTSS Center for Information and Training Team if you have questions regarding this letter at PFD-LTSS@hhs.texas.gov or (737) 867-7817.

Sincerely,

[Signature on file]

Samuel West, Director of Provider Finance for Long-term Services and Supports.`,
22: `## You are to
1. If you are late or cannot report for assignment, call the member to whom you are being assigned and contact the office immediately. Work your scheduled hours as printed on your visit plan form and any changes must be pre-approved.
1. Report any injuries that occur while working within 24 hours.
1. Report any changes in your member's health conditions and hospitalizations.
1. Report if the member does not receive their Medicaid.
1. Always obtain a receipt in return for any groceries or goods purchased for members.
1. If your work assignment/environment becomes intolerable, call Primetime Home Health Services immediately. Do not argue with the members. Do not walk off the job! This can result in legal complications. Your immediate supervisor will determine what the best course of action will be for each situation.
1. When you complete an assignment, notify us of your availability. Failure to report your availability upon completion of a job assignment or failure to accept an assignment may affect your unemployment benefits.

## You are not allowed to
1. Accept any gift or money from the member for services which you perform as an attendant.
1. Eat, drink, smoke, watch TV, or sleep at the member's home during your scheduled working hours.
1. Change your working hours schedule without pre-approval by the Agency.
1. Take guests with you to work (including spouse, children, or friends).
1. Use members' phones for personal use.
1. Borrow money from members or enter any type of business transaction.
1. Administer any type of medication to the member.
1. Handle any business affairs for the members.
1. Run errands for the members during your scheduled working hours.

## Probation
Each new employee of Primetime Home Health Services, Inc. is on a one-year probation. Your skills will be evaluated by the administrator or designee during this time. Our members are in constant communication with our staff, expressing their positive and negative observations at work.

## Overtime
Absolutely no overtime is allowed (over 40 hours a week).

Any breach of these policies can result in immediate termination, or be reportable to STATE/APS under ANE.

If you have any questions, or need additional instructions, please call the office and we will gladly assist you!`,
23: `Employee and Company are referred to from time to time herein as the Parties. By signing this Employee Class Waiver and Arbitration Agreement (Agreement), and in consideration of Primetime Home Health Services, Inc. (Company) mutual agreement to arbitration and employment of Employee, Employee agrees as follows:

## Arbitration and dispute resolution
Any controversy or dispute between Employee and Company or any of its employees, owners, directors, parent companies, subsidiaries, affiliates, or officers, arising from or in any way related to Employee's employment or work with Company, expressly including, but not limited to, any dispute about the interpretation, validity, scope, or enforceability of this Agreement, including the arbitration clause, any claim of employment discrimination, such as, but not limited to, discrimination based on age, disability, national origin, race, or sex, or any other protected characteristic, under Title VII, the Americans with Disabilities Act, the Age Discrimination in Employment Act, the Older Workers Benefit Protection Act, or similar federal, state, or local law, any claim for compensation or benefits, including any claim under the Fair Labor Standards Act or the Employee Retirement Income Security Act or any other federal or state statute or regulation related to payment of wages or benefits, the Family Medical Leave Act or related state law or any related regulation, or any related state law or regulation of any sort or any other claim, whether contractual, common-law, statutory, or regulatory, arising out of, or in any way related to, this Agreement and Employee's employment with Company, the termination thereof, or any other matter incident thereto must be resolved exclusively by final and binding arbitration in Houston, Harris County, Texas and administered by American Arbitration Association (AAA) under its Employment Arbitration Rules & Mediation Procedures, including the Optional Rules for Emergency Measures of Protection, then applicable to the dispute, except that the AAA's Supplementary Rules for Class Arbitrations shall not apply because the Parties agree not to arbitrate class or collective action claims.

It is the intent of the parties that this Agreement shall be construed as broadly as legally possible and shall apply to any and all legally cognizable disputes between them regardless of when the dispute has arisen or may arise and includes any dispute that occurred before or after the Parties execute this Agreement. The applicable AAA rules and other information regarding the administration of claims in arbitration can be found at www.adr.org. Employee is encouraged to review these rules prior to executing this Agreement.

The Parties waive any right to have any claim heard by a judge or jury. This Agreement shall be governed by the Federal Arbitration Act. When state law applies, the laws of the State of Texas shall apply to this Agreement. The Parties further agree that the arbitrator may make an award of any relief, legal or equitable, interim or final, which could be granted by a court of competent jurisdiction.

Notwithstanding the foregoing, this Agreement does not require arbitration of claims that, under the controlling law, cannot be arbitrated. This Agreement does not preclude Employee from filing an administrative charge or claim with the National Labor Relations Board (Board) or from accessing the Board's processes. This Agreement also does not preclude Employee from filing an administrative charge or claim with the Equal Employment Opportunity Commission, the Department of Labor, or any similar state or federal agency.

## Waiver of class and collective standing or action
To the fullest extent permitted by law, Employee expressly waives the right to bring, file, or join any class or collective action against Company, as well as against Company's other employees, owners, directors, parent companies, subsidiaries, affiliates, or officers. Employee expressly agrees that Employee will resolve any dispute or claim in a single action between only Employee and Company and Company's other employees, owners, directors, parent companies, subsidiaries, affiliates, or officers. Accordingly, Employee agrees that Employee will not serve as a class or collective action representative or join a class or collective action against Company or Company's other employees, owners, directors, parent companies, subsidiaries, affiliates, or officers.`
};

export const POLICY_EDITION = "digital-reading-2026-11-05-v2";
export function policyDocument(page: number) {
  const text = documents[page];
  if (!text) return null;
  return { edition: POLICY_EDITION, text, contentSha256: createHash("sha256").update(text).digest("hex") };
}
