import { policyDocument, POLICY_EDITION } from "./policyDocuments.js";
// Digital reading editions preserve the supplied substantive terms.
// Served only through the recently authenticated, collection-gated API.
export const readings = [
 {page:6,title:"Criminal check addendum",note:"Read the addendum. The office handles screening; this is not a completed background check."},
 {page:8,title:"Verification of employability",note:"Read the notice. The office performs and records the applicable verification."},
 {page:9,title:"Confidentiality of patient information and medical records",agreement:true},
 {page:10,title:"Protected personal health information pledge",agreement:true,note:"The office will clarify the incomplete wording in this pledge and discuss it with you before signing."},
 {page:12,title:"Emergency preparedness statement",note:"This is the statement in your packet. The office must supply and discuss the complete emergency policy before confirming training or policy receipt."},
 {page:13,title:"Employee contract addendum",agreement:true},
 {page:14,title:"Bloodborne pathogens information",note:"Reading this fact sheet does not certify completion of training."},
 {page:15,title:"Hepatitis B vaccination or decline",note:"Medical decisions and vaccination/declination records are completed privately with the office; reading does not elect or decline vaccination."},
 {page:16,title:"Workers compensation notice"},
 {page:17,title:"Health insurance coverage election",note:"Reading does not elect or waive coverage. The office will collect your separate election."},
 {page:18,title:"Direct deposit notification",note:"Use the approved payroll process for banking information. Do not email banking details as described in the historical page."},
 {page:19,title:"Orientation checklist",note:"The office and the employee complete actual training and orientation attestations together."},
 {page:20,title:"HHSC attendant payment rates",note:"Agency rate reference dated September 8, 2025; this is not an individual wage offer."},
 {page:21,title:"HHSC rate approvals, claims and resources"},
 {page:22,title:"Attendant policies, probation and overtime",agreement:true},
 {page:23,title:"Class waiver and arbitration agreement",agreement:true},
].map(reading => ({...reading, edition: POLICY_EDITION, contentSha256: policyDocument(reading.page)!.contentSha256, sourcePages: [reading.page*2-1, ...([8,14,20,21,22].includes(reading.page)?[reading.page*2]:[])], hasContinuation:[8,14,20,21,22].includes(reading.page)}));
export const referencePages: number[] = [];
