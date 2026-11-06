import { createHash } from "node:crypto";
// Full reading text transcribed from the owner's packet, pages 1–2, REV 04/25.
// Source wording is retained; display is not a new legal/eligibility determination.
export const jobDescription = {
  id: "pas-attendant-job-description", revision: "REV 04/25", sourcePages: [1, 3],
  title: "PAS ATTENDANT EMPLOYMENT APPLICATION",
  introduction: "The PAS attendant is responsible for providing personal assistance to the client in accordance with the established service plan to enable the client to function in the home and community.",
  qualifications: [
    "The agency shall employ a attendant who:",
    "Be at least 18 years of age",
    "Can be spouses of clients, however, if they live with clients cannot have a job outside the home",
    "Be neither legal nor foster parents of minor children who receive the services",
    "Free of communicable disease and open infections, wounds",
    "Must have reliable transportation",
    "Must be able to read and write English"
  ],
  duties: [
    "Shall perform services as identified on Service Plan",
    "Report to the supervisor on the day of awareness of any significant changes in client's condition.",
    "Shall report emergency situations to appropriate individuals in accordance with policies immediately upon awareness"
  ],
  essentialFunctions: [
    "Must be able to stand and walk throughout majority of shift on various surfaces in client's homes.",
    "Must be able to lift and carry items up to 30 pounds such as mop, buckets, groceries, and bags with trash.",
    "Must be able to push/pull up to various weights while performing tasks such as pushing client wheelchair and transferring the client.",
    "Must be able to climb stairs to various clients' houses.",
    "Must be able to bend, twist, and reach when performing various job functions such as cleaning throughout the shift.",
    "Must be able to handle objects such as wheelchair, brooms, mops, dishes, and vacuum cleaner.",
    "Must be able to communicate effectively with clients.",
    "The overall environment must be able to work in various degrees of temperature, depending upon client's house setting. Position requires working with various cleaning solvents, fumes, dust and odors",
    "Must be sensitive to the needs of the aged and disabled and conscientious about services client's need.",
    "Must not be short tempered and must be slow to anger and be able to respond in a calm way and be able to work in an often-stressful situation when dealing with patients who may be abusive.",
    "Must be alert and able to identify hazards should one occur, to avoid them by, reporting immediately or if directed, to take corrective actions."
  ],
  initialAcknowledgment: "I have read the above job description and agree to adhere to it: and all questions have been answered on this date regarding understanding the above job duties.",
  discussionAcknowledgment: "The above-listed job description has been revised and discussed with me, and I have had an opportunity to ask questions regarding same:",
  signatureLines: ["Employee Signature", "Date", "Supervisor Signature", "Date"]
};
export const jobDescriptionSha256 = createHash("sha256").update(JSON.stringify(jobDescription)).digest("hex");
