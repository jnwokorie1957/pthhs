(() => {
  const panel = document.getElementById('operationalWorkspace');
  if (!panel) return;
  let dataApproved = false;
  let rateCreationWritesEnabled = false, pendingRateCreationId = null;
  let topicWritesEnabled = false, pendingTopicId = null;
  let availabilityCreationWrites = [], pendingAvailabilityCreationId = null;
  let patientNoteWritesEnabled = false, pendingPatientNoteId = null;
  let collectionNoteWritesEnabled = false, pendingCollectionNoteId = null;
  let linkedScheduleCreationWritesEnabled = false, pendingLinkedScheduleCreationId = null;
  let referralCreationWritesEnabled = false, pendingReferralCreationId = null;
  let contractCreationWritesEnabled = false, pendingContractCreationId = null;
  let caregiverPictureWritesEnabled = false, pendingCaregiverPictureId = null;
  let documentCreationWrites = [], pendingDocumentCreationId = null;
  let documentReplacementWrites = [], pendingDocumentReplacementId = null;
  let documentMetadataWrites = [], pendingDocumentMetadataId = null;
  let medicalCreationWritesEnabled = false, pendingMedicalCreationId = null;
  let patientClinicalWritesEnabled = false, pendingPatientClinicalId = null;
  let patientContractWritesEnabled = false, pendingPatientContractId = null;
  let documentTypeWritesEnabled = false, pendingDocumentTypeId = null;
  let readSequence = 0, readInputs = {}, availabilityWrites = [], pendingAvailabilityId = null;
  let generation = 0, writesEnabled = false, settings = null, investigations = [], intents = [], pendingIntentId = null, pendingRateId = null;
  const $ = id => document.getElementById(id);
  const message = text => { $('workspaceMessage').textContent = text; };
  const names = { "GetPatientContracts": "Patient contracts on selected date", "GetPatientDisciplines": "Patient disciplines", "GetPatientReferralInfo": "Patient referral status (optional for admission)", "GetPatientPreferences": "Patient staffing preferences", "GetPatientDeclinedCaregivers": "Patient declined caregivers", "GetCaregiverRates": "Caregiver pay rates", "GetCaregiverPayCodes": "Caregiver pay codes", "GetCaregiverInServices": "Caregiver training attendance", "GetCaregiverRestriction": "Caregiver restrictions", "GetCaregiverPreferences": "Caregiver staffing preferences", "SearchPayrollBatches": "Find payroll batches by date", "SearchPayrollBatchCaregivers": "Caregivers in selected batch (record ID = batch)", "GetVisitPayrollInfoV2": "Visit payroll facts", "SearchPatientPOC": "Patient care plans", "GetPatientPOCInfo": "Care plan tasks (record ID = plan)", SearchVisitsV2: 'Find visits by office and date', GetScheduleInfo: 'Schedule details', GetVisitInfoV3: 'Visit and EVV evidence', GetPatientDemographics: 'Patient overview', GetCaregiverDemographics: 'Caregiver overview', GetPatientAuthorizationInfo: 'Authorization units', GetVisitBillInfoV2: 'Visit billing facts', GetCaregiverPermanentWeekAvailability: 'Weekly availability', GetCaregiverSpecialAvailability: 'Special availability' };
  const inputIds = { id: 'readId', patientId: 'readPatient', officeId: 'readOffice', date: 'readDate', term: 'readTerm', status: 'readStatus', contractId: 'readContract', caregiverId: 'readCaregiver', excludeZeroAmount: 'readExcludeZero', groupByVisit: 'readGroupVisit', modifiedAfter: 'readModifiedAfter', page: 'readPage', complianceType: 'readComplianceType', sequence: 'readSequence', documentTypeId: 'readDocumentType', scheduleType: 'readScheduleType', appliesTo: 'readAppliesTo', caregiverStatus: 'readCaregiverStatus', modifiedAfterUtc: 'readModifiedUtc', lastId: 'readLastId', phone: 'readPhone', noteId: 'readNoteId', referralStatusId: 'readReferralStatus', referralSourceId: 'readReferralSource', salesStaffId: 'readSalesStaff' };
  function showReadInputs() {
    const fields = readInputs[$('readOperation').value];
    for (const [field, id] of Object.entries(inputIds)) $(id).closest('label').hidden = fields ? !fields.includes(field) : false;
  }
  function selectRead(operation) { $('readOperation').value = operation; readSequence++; $('readResults').replaceChildren(); showReadInputs(); }
  $('readOperation').addEventListener('change', () => selectRead($('readOperation').value));
  async function request(path, body, expectedGeneration = generation) {
    if (expectedGeneration !== generation) throw new Error('Session changed. Start this action again.');
    if (path !== 'settings' && !dataApproved) throw new Error('Operational data is locked until release approval.');
    const current = generation;
    const response = await window.primetimeApiFetch('/primetime/api/workspace/' + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (current !== generation) throw new Error('Session changed. Sign in again.');
    if (!response.ok || !result.ok) throw new Error(({ operational_data_release_not_approved: 'Operational data is locked pending deployment and privacy approval. Owner preferences can still be configured.', read_not_owner_enabled: 'Enable this read in owner controls after entitlement review.', revision_conflict: 'Another administrator updated this record. Reload before retrying.', independent_reviewer_required: 'A different administrator must review this request.', vendor_contract_clarification_required: 'This operation is absent from or removed by the vendor guide. Vendor clarification is required before it can be enabled.', workspace_unavailable: 'Workspace storage is unavailable. Verify backend deployment and Firestore, then retry.' })[result.error] || (result.error || 'Request failed').replaceAll('_', ' '));
    return result;
  }
  async function action(task) { try { message('Working…'); await task(); } catch (error) { message(error.message); } }
  function button(label, click) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn secondary'; b.textContent = label; b.addEventListener('click', () => action(async () => { b.disabled = true; try { await click(); } finally { b.disabled = false; } })); return b; }
  function paragraph(text) { const p = document.createElement('p'); p.textContent = text; return p; }
  function setDataAccess(enabled) {
    dataApproved = enabled;
    for (const form of panel.querySelectorAll('form')) {
      if (form.id === 'ownerForm') continue;
      if (!enabled) form.reset();
      for (const input of form.querySelectorAll('input, select, textarea, button')) input.disabled = !enabled;
    }
    if (!enabled) for (const id of ['linkedScheduleCreations','collectionNoteChanges','referralCreations','contractCreations','caregiverPictureChanges','documentCreationChanges','documentReplacementChanges','medicalCreations','patientClinicalChanges','documentMetadataChanges','patientNoteChanges','availabilityCreations','patientContractChanges','rateCreations','topicChanges','documentTypeChanges','availabilityChanges','staffingEvidence','readResults','investigationList','intentList','workspaceAudit']) $(id)?.replaceChildren();
  }
  setDataAccess(false);
  function reset() { linkedScheduleCreationWritesEnabled = false; pendingLinkedScheduleCreationId = null; setDataAccess(false); collectionNoteWritesEnabled = false; pendingCollectionNoteId = null; referralCreationWritesEnabled = false; pendingReferralCreationId = null; contractCreationWritesEnabled = false; pendingContractCreationId = null; caregiverPictureWritesEnabled = false; pendingCaregiverPictureId = null; documentCreationWrites = []; pendingDocumentCreationId = null; documentReplacementWrites = []; pendingDocumentReplacementId = null; medicalCreationWritesEnabled = false; pendingMedicalCreationId = null; patientClinicalWritesEnabled = false; pendingPatientClinicalId = null; documentMetadataWrites = []; pendingDocumentMetadataId = null; patientNoteWritesEnabled = false; pendingPatientNoteId = null; $("patientNoteForm").reset(); $("patientNoteChanges").replaceChildren(); availabilityCreationWrites = []; pendingAvailabilityCreationId = null; $("availabilityCreationForm").reset(); $("availabilityCreations").replaceChildren(); patientContractWritesEnabled = false; pendingPatientContractId = null; $("patientContractForm").reset(); $("patientContractChanges").replaceChildren(); rateCreationWritesEnabled = false; pendingRateCreationId = null; $("rateCreationForm").reset(); $("rateCreations").replaceChildren(); topicWritesEnabled = false; pendingTopicId = null; $("topicForm").reset(); $("topicChanges").replaceChildren(); documentTypeWritesEnabled = false; pendingDocumentTypeId = null; $("documentTypeForm").reset(); $("documentTypeChanges").replaceChildren(); generation++; readSequence++; readInputs = {}; writesEnabled = false; settings = null; investigations = []; intents = []; pendingIntentId = null; pendingRateId = null; $('rateProposalForm').reset(); $('staffingReviewForm').reset(); $('availabilityForm').reset(); availabilityWrites = []; pendingAvailabilityId = null; for (const id of ['availabilityChanges', 'staffingEvidence', 'readResults', 'investigationList', 'intentList', 'workspaceAudit']) $(id)?.replaceChildren(); $('investigationForm').reset(); $('intentForm').reset(); $('readForm').reset(); $('ownerForm').reset(); $('readPermissions').replaceChildren(); message('Sign in to load operational controls.'); }
  document.addEventListener('primetime-signed-out', reset);
  async function loadSettings() {
    const data = await request('settings'); linkedScheduleCreationWritesEnabled = data.linkedScheduleCreationWritesEnabled === true; collectionNoteWritesEnabled = data.collectionNoteWritesEnabled === true; referralCreationWritesEnabled = data.referralCreationWritesEnabled === true; contractCreationWritesEnabled = data.contractCreationWritesEnabled === true; caregiverPictureWritesEnabled = data.caregiverPictureWritesEnabled === true; documentCreationWrites = data.documentCreationWrites || []; documentReplacementWrites = data.documentReplacementWrites || []; medicalCreationWritesEnabled = data.medicalCreationWritesEnabled === true; patientClinicalWritesEnabled = data.patientClinicalWritesEnabled === true; documentMetadataWrites = data.documentMetadataWrites || []; patientNoteWritesEnabled = data.patientNoteWritesEnabled === true; availabilityCreationWrites = data.availabilityCreationWrites || []; patientContractWritesEnabled = data.patientContractWritesEnabled === true; settings = data.settings; writesEnabled = data.writesEnabled === true; documentTypeWritesEnabled = data.documentTypeWritesEnabled === true; topicWritesEnabled = data.topicWritesEnabled === true; rateCreationWritesEnabled = data.rateCreationWritesEnabled === true; readInputs = data.readInputs || {}; availabilityWrites = data.availabilityWrites || []; showReadInputs();
    $('ownerOffice').value = settings.officeId || ''; $('ownerTimezone').value = settings.officeTimezone || ''; $('ownerReference').value = settings.policyReference;
    $('ownerInMinutes').value = settings.missingClockInMinutes ?? ''; $('ownerOutMinutes').value = settings.missingClockOutMinutes ?? '';
    $('readOffice').value = settings.officeId || ''; $('staffingOffice').value = settings.officeId || '';
    $('readPermissions').replaceChildren();
    for (const option of $('readOperation').options) option.disabled = (data.contractOnlyReads || []).includes(option.value);
    for (const op of data.supportedReads) { const label = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.value = op; input.checked = settings.enabledReads.includes(op); label.append(input, document.createTextNode(' ' + (names[op] || [...$('readOperation').options].find(option => option.value === op)?.textContent || op))); $('readPermissions').append(label); }
    $('dataGate').textContent = data.dataApproved ? 'Operational data release approved. Individual reads still require owner enablement. Source values remain unvalidated.' : 'Operational data locked. Deployment approval is required before reads or investigation notes can be stored. Preferences do not change this gate.';
    setDataAccess(data.dataApproved === true);
    const enabledWrites = [linkedScheduleCreationWritesEnabled,writesEnabled, documentTypeWritesEnabled, topicWritesEnabled, rateCreationWritesEnabled, patientContractWritesEnabled, patientNoteWritesEnabled, patientClinicalWritesEnabled, medicalCreationWritesEnabled, caregiverPictureWritesEnabled, contractCreationWritesEnabled, referralCreationWritesEnabled, collectionNoteWritesEnabled].filter(Boolean).length + availabilityWrites.length + availabilityCreationWrites.length + documentMetadataWrites.length + documentReplacementWrites.length + documentCreationWrites.length;
    message(`Owner controls loaded. ${enabledWrites} specific write workflows have release approval; all other submissions remain locked.`);
  }
  document.addEventListener('primetime-ready', () => action(loadSettings));
  $('reloadWorkspace').addEventListener('click', () => action(loadSettings));
  $('ownerForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    if (!settings) throw new Error('Load owner controls first.');
    const threshold = id => $(id).value === '' ? null : Number($(id).value);
    const result = await request('settings', { revision: settings.revision, officeId: $('ownerOffice').value || null, officeTimezone: $('ownerTimezone').value || null, policyReference: $('ownerReference').value, enabledReads: [...$('readPermissions').querySelectorAll('input:checked')].map(input => input.value), missingClockInMinutes: threshold('ownerInMinutes'), missingClockOutMinutes: threshold('ownerOutMinutes') });
    settings = result.settings; $('readOffice').value = settings.officeId || ''; $('staffingOffice').value = settings.officeId || ''; message('Preferences saved with an audit event. Thresholds are review configuration; automated decisions remain disabled.');
  }); });
  $('readForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    const sequence = ++readSequence; $('readResults').replaceChildren();
    const operation = $('readOperation').value, fields = readInputs[operation];
    if (!fields) throw new Error('Load owner controls before requesting source data.');
    const input = { operation };
    for (const field of fields) input[field] = $(inputIds[field]).value;
    const data = await request('read', input);
    if (sequence !== readSequence) return;
    const target = $('readResults'); target.append(paragraph(`${names[data.operation] || data.operation}: Fetched ${new Date(data.fetchedAt).toLocaleString()} from HHA. Source timestamps are not converted. Field interpretation is pending validation. ${data.truncated ? 'Only the first 200 rows are shown; narrow the request.' : ''}`));
    if (data.attachment) {
      const file = data.attachment;
      target.append(paragraph(`Attachment ready: ${file.filename}, ${file.byteLength} bytes. The file is not rendered in this page.`));
      target.append(button('Save attachment to this device', async () => {
        if (!window.confirm('Save this source attachment to this device? Follow your organization’s handling policy for downloaded records.')) return;
        const bytes = Uint8Array.from(atob(file.base64), character => character.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
        const link = document.createElement('a'); link.href = url; link.download = file.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }));
    }
    if (data.changePreview) target.append(paragraph(`Change preview only. Request boundary ${data.changePreview.modifiedAfter} uses ${data.changePreview.timeBasis === "UTC" ? "explicit UTC" : "vendor EST wall time without conversion"}. Completeness is not inferred; no durable sync checkpoint was advanced. ${data.changePreview.page ? 'Requested page ' + data.changePreview.page + '. Confirm vendor paging termination before import.' : ''}`));
    if (data.operation === 'SearchVisitsV2' && data.records.length) {
      const ids = data.records.map(record => record.VisitID).filter(Boolean); let offset = 0;
      const review = button('Inspect next 10 visits for EVV evidence', async () => {
        const batch = ids.slice(offset, offset + 10), reviewData = await request('visit-review', { visitIds: batch });
        offset += batch.length;
        const queue = document.createElement('section'); queue.className = 'panel';
        queue.append(paragraph(`Visit evidence review ${reviewData.state}. Source fields remain unvalidated. No lateness, payroll or billing policy was applied.`));
        for (const row of reviewData.visits) {
          const card = document.createElement('article'); card.className = 'panel';
          card.append(paragraph(`Visit ${row.visitId}: ${row.state}. ${row.fetchedAt ? 'Fetched ' + row.fetchedAt : 'No successful read.'}`));
          if (row.error) card.append(paragraph(row.error.replaceAll('_', ' ')));
          else {
            card.append(paragraph(row.flags.length ? row.flags.join('; ') : 'Both EVV clock fields were returned. Validity is not yet established.'));
            for (const name of ['VisitStartTime', 'VisitEndTime', 'EVVStartTime', 'EVVEndTime', 'ActualHours', 'PayHours', 'AdjustedHours']) card.append(paragraph(`${name}: ${row.facts[name] ?? 'Not supplied / unknown'}`));
            card.append(button('Investigate visit ' + row.visitId, async () => { $('investigationForm').reset(); $('investigationVisit').value = row.visitId; $('investigationTitle').value = 'Review source EVV evidence'; $('investigationNote').focus(); message('Visit selected for investigation. Record the verified findings.'); }));
          }
          queue.append(card);
        }
        target.prepend(queue);
        if (offset >= ids.length) review.remove();
        message(`Evidence review ${reviewData.state}; ${offset} of ${ids.length} selected visits attempted or deferred. Refresh discovery to retry unavailable visits.`);
      }); target.append(review);
    }
    if (['GetCaregiverMedicalDetails', 'GetCaregiverComplianceItemDue', 'GetNumberOfComplianceItemDue'].includes(data.operation)) target.append(paragraph('Vendor compliance view only; this does not establish fitness or scheduling eligibility. Pending covers the vendor’s next 90 days and overdue its previous six months. Sequence completeness is not inferred; a displayed count applies only to the chosen item and filters.'));
    if (data.operation === 'GetPatientClinicalInfo') target.append(paragraph('Readiness intervals are source days, not calculated deadlines or clinical instructions. Missing values remain unknown.'));
    if (!data.records.length) target.append(paragraph('No records returned. This is not a zero census or a zero balance.'));
    for (const record of data.records) {
      const card = document.createElement('article'); card.className = 'panel';
      const dl = document.createElement('dl');
      for (const [key, value] of Object.entries(record)) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = key; dd.textContent = value === null ? 'Not supplied / unknown' : String(value); dl.append(dt, dd); }
      card.append(dl);
      if (['GetScheduleInfo', 'GetLinkedScheduleInfo'].includes(data.operation)) card.append(button('Review schedule preservation evidence', async () => {
        const review = await request('schedule-review', { visitId: record.ID, kind: data.operation === 'GetLinkedScheduleInfo' ? 'linked' : 'standard' });
        const section = document.createElement('section'); section.className = 'panel';
        section.append(paragraph(`Schedule ${review.visitId}: read-only review. ${review.caution}`), ...review.unresolved.map(paragraph));
        for (const source of review.sources) { section.append(paragraph(`${source.operation}, fetched ${source.fetchedAt}`)); for (const [key, value] of Object.entries(source.records[0])) section.append(paragraph(`${key}: ${value ?? 'Unknown / not returned'}`)); }
        $('readResults').prepend(section); message('Schedule preservation evidence loaded. No update was prepared or submitted.');
      }));
      if (['GetCaregiverPermanentWeekAvailability', 'GetCaregiverSpecialAvailability'].includes(data.operation)) card.append(button('Propose availability change', async () => {
        const special = data.operation === 'GetCaregiverSpecialAvailability'; $('availabilityOperation').value = special ? 'UpdateCaregiverSpecialAvailability' : 'UpdateCaregiverPermanentWeekAvailability';
        $('availabilityCaregiver').value = record.CaregiverID; $('availabilityRecord').value = special ? record.SpecialAvailabilityID : record.PermanentWeekID; $('availabilityFrom').focus();
        message('Availability record selected. Preparation reads the source again and preserves other days.');
      }));
      if (['GetCaregiverMedicals', 'GetCaregiverOtherCompliance'].includes(data.operation)) card.append(button('Review this item’s due count', async () => {
        const medical = data.operation === 'GetCaregiverMedicals';
        $('readId').value = medical ? record.MedicalID : record.OtherComplianceID;
        $('readComplianceType').value = medical ? 'Medical' : 'OtherCompliance'; $('readOffice').value = record.OfficeID;
        $('readStatus').value = ''; selectRead('GetNumberOfComplianceItemDue'); message('Compliance item selected. Choose a status filter if needed; the count is not an eligibility decision.');
      }));
      if (['GetPatientDemographics', 'GetCaregiverDemographics'].includes(data.operation)) card.append(button('Inspect document metadata', async () => {
        const patient = data.operation === 'GetPatientDemographics';
        $(patient ? 'readPatient' : 'readCaregiver').value = patient ? record.PatientID : record.ID;
        $('readId').value = ''; $('readDocumentType').value = ''; $('readDate').value = '';
        selectRead(patient ? 'SearchPatientDocument' : 'SearchCaregiverDocument'); message('Subject selected. Metadata does not download document content. Optional filters narrow the search.');
      }));
      if (['SearchPatientDocument', 'SearchCaregiverDocument'].includes(data.operation)) card.append(button('Inspect this document type', async () => {
        const patient = data.operation === 'SearchPatientDocument';
        $('readId').value = patient ? record.PatientDocID : record.CaregiverDocID; $('readStatus').value = '';
        selectRead(patient ? 'GetPatientDocumentType' : 'GetCaregiverDocumentType'); message('Known document selected for its type metadata.');
      }));
      if (data.operation === 'GetPatientDemographics') card.append(button('Inspect clinical readiness intervals', async () => { $('readPatient').value = record.PatientID || record.ID; selectRead('GetPatientClinicalInfo'); message('Patient selected for source readiness intervals.'); }));
      if (data.operation === 'GetCaregiverDemographics') card.append(button('Inspect medical compliance dates', async () => { $('readCaregiver').value = record.CaregiverID || record.ID; $('readId').value = ''; $('readStatus').value = ''; selectRead('GetCaregiverMedicalDetails'); message('Caregiver selected. Source compliance dates do not establish fitness or assignment eligibility.'); }));
      if (data.operation === 'SearchPatients' || data.operation === 'SearchCaregivers') card.append(button('Select record', async () => { $('readId').value = record.PatientID || record.CaregiverID; $('readPatient').value = record.PatientID || ''; selectRead(data.operation === 'SearchPatients' ? 'GetPatientDemographics' : 'GetCaregiverDemographics'); message('Record selected for a targeted read.'); }));
      if (data.operation === 'SearchPatientAuthorizations') card.append(button('Inspect authorization units', async () => { $('readId').value = record.ID; selectRead('GetPatientAuthorizationInfo'); message('Authorization selected. Patient ID is retained from the search.'); }));
      if (data.operation === 'SearchPayrollBatches') card.append(button('Inspect selected batch details', async () => { $('readId').value = record.BatchID; $('readCaregiver').value = ''; selectRead('GetPayrollBatchDetails'); message('Selected batch only. Source duration fields are minutes, including those named Hours. Grouping is a read filter; no payroll is recalculated.'); }));
      if (data.operation === 'SearchBilledVisits') card.append(button('Inspect collection follow-up', async () => { $('readId').value = record.VisitID; $('readPatient').value = record.PatientID; $('readContract').value = record.ContractID; selectRead('GetCollectionNotes'); message('Visit, patient and contract selected. Collection notes are not proof of cash received.'); }));
      if (data.operation === 'SearchPayrollBatches') card.append(button('Inspect selected batch caregivers', async () => { $('readId').value = record.BatchID; selectRead('SearchPayrollBatchCaregivers'); message('Selected batch only. No prior batch records are carried forward.'); }));
      if (data.operation === 'SearchPayrollBatchCaregivers') card.append(button('Inspect caregiver pay rates', async () => { $('readId').value = record.CaregiverID; selectRead('GetCaregiverRates'); message('Caregiver selected. Source rates are not a payroll calculation or payment.'); }));
      if (data.operation === 'SearchPatientPOC') card.append(button('Inspect care plan tasks', async () => { $('readId').value = record.ID; selectRead('GetPatientPOCInfo'); message('Care plan selected. No care instructions are changed.'); }));
      if (data.operation === 'GetCaregiverRates') card.append(button('Prepare review of this rate', async () => { $('rateCaregiver').value = record.CaregiverID; $('rateId').value = record.CaregiverRateID; $('rateAmount').value = ''; $('rateRationale').value = ''; $('rateAmount').focus(); message('Rate selected. Enter the proposed hourly rate and reason; no source write will occur.'); }));
      const visitId = record.VisitID || (['GetScheduleInfo', 'GetVisitInfoV3', 'GetVisitBillInfoV2', 'GetVisitPayrollInfoV2'].includes(data.operation) ? record.ID : null);
      if (visitId) card.append(button('Review this visit', async () => { $('investigationVisit').value = visitId; $('intentVisit').value = visitId; $('readId').value = visitId; selectRead('GetVisitInfoV3'); message('Visit selected. Open its evidence or create an investigation below.'); }));
      target.append(card);
    }
    message(`Read completed: ${data.records.length} record(s). No source records changed.`);
  }); });
  $('availabilityForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingAvailabilityId ||= crypto.randomUUID();
    await request('availability-proposals', { id: pendingAvailabilityId, operation: $('availabilityOperation').value, caregiverId: $('availabilityCaregiver').value, recordId: $('availabilityRecord').value, day: $('availabilityDay').value, availabilityType: $('availabilityType').value, liveIn: $('availabilityLiveIn').value, from: $('availabilityFrom').value, to: $('availabilityTo').value, rationale: $('availabilityRationale').value });
    pendingAvailabilityId = null; await loadAvailability(); message('Availability proposal saved. Recheck source and obtain independent review before any submission.');
  }); });
  $('rateCreationForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingRateCreationId ||= crypto.randomUUID();
    await request('rate-creations/prepare', { id: pendingRateCreationId, caregiverId: $('newRateCaregiver').value, disciplineId: $('newRateDiscipline').value, payCodeId: $('newRatePayCode').value, patientId: $('newRatePatient').value || null, fromDate: $('newRateFrom').value, toDate: $('newRateTo').value, hourlyRate: $('newRateHourly').value, dailyRate: $('newRateDaily').value, visitRate: $('newRateVisit').value || null, status: $('newRateStatus').value, rationale: $('newRateReason').value });
    pendingRateCreationId = null; await loadRateCreations(); message('New caregiver rate saved for source recheck and independent review.');
  }); });
  async function loadRateCreations(cursor) {
    const data = await request('rate-creations' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('rateCreations'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const facts = change.proposed, card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`New rate for caregiver ${facts.CaregiverID}; office ${change.officeId}; ${change.state}.`), paragraph(`Pay code ${facts.PayCodeID}; discipline ${facts.Discipline} (${facts.DisciplineName}); patient ${facts.PatientID || 'Not supplied'}. From ${facts.FromDate} to ${facts.ToDate}; status ${facts.Status}.`), paragraph(`Hourly ${facts.HourlyRate}; daily ${facts.DailyRate}; visit ${facts.VisitRate ?? 'Not supplied'}. This does not execute payroll.`), paragraph(`Reason: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));
      const call = async (action, extra = {}) => { await request('rate-creations/' + action, { id: change.id, revision: change.revision, ...extra }); await loadRateCreations(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck new rate source', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved', 'rejected']) card.append(button('New rate ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Create approved caregiver rate once', async () => { if (window.confirm('Create this independently approved caregiver rate in HHA once? Review every amount, date and code above.')) await call('execute'); }); submit.disabled = !rateCreationWritesEnabled; card.append(submit); }
      } else if (change.execution) { card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}; returned rate ID: ${change.execution.vendorRecordId || 'Unknown'}.`), button('Reconcile new rate (read only)', () => call('reconcile'))); }
      if (change.state === 'approved') card.append(recoveryControls(change, 'rate_create', loadRateCreations));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older new rate reviews', () => loadRateCreations(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadRateCreations').addEventListener('click', () => action(() => loadRateCreations()));
  $('topicForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingTopicId ||= crypto.randomUUID();
    await request('topics/prepare', { id: pendingTopicId, topic: $('topicName').value, status: $('topicStatus').value, countTowardsCompliance: $('topicCompliance').value, rationale: $('topicReason').value });
    pendingTopicId = null; await loadTopics(); message('Training topic saved for source recheck and independent review.');
  }); });
  async function loadTopics(cursor) {
    const data = await request('topics' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('topicChanges'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`New training topic: ${change.topic}; office ${change.officeId}; ${change.state}.`), paragraph(`Status: ${change.proposed.Status}; count toward compliance: ${change.proposed.CountTowardsCompliance}. This does not certify attendance.`), paragraph(`Reason: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));
      const call = async (action, extra = {}) => { await request('topics/' + action, { id: change.id, revision: change.revision, ...extra }); await loadTopics(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck topic catalog', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved', 'rejected']) card.append(button('Topic ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Create approved training topic once', async () => { if (window.confirm('Create this training topic and its selected compliance setting in HHA once?')) await call('execute'); }); submit.disabled = !topicWritesEnabled; card.append(submit); }
      } else if (change.execution) { card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}; returned office topic ID: ${change.execution.vendorRecordId || 'Unknown'}.`), button('Reconcile training topic (read only)', () => call('reconcile'))); }
      if (change.state === 'approved') card.append(recoveryControls(change, 'topic', loadTopics));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older topic reviews', () => loadTopics(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadTopics').addEventListener('click', () => action(() => loadTopics()));
  $('availabilityCreationForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingAvailabilityCreationId ||= crypto.randomUUID();
    const days = Object.fromEntries([...$('availabilityCreationDays').querySelectorAll('[data-field]')].map(input => [input.dataset.field, input.value]));
    await request('availability-creations/prepare', { id: pendingAvailabilityCreationId, operation: $('availabilityCreationOperation').value, caregiverId: $('availabilityCreationCaregiver').value, fromDate: $('availabilityCreationFrom').value, toDate: $('availabilityCreationTo').value, days, rationale: $('availabilityCreationReason').value });
    pendingAvailabilityCreationId = null; await loadAvailabilityCreations(); message('New availability proposal saved. Source recheck and independent review are required.');
  }); });
  async function loadAvailabilityCreations(cursor) {
    const data = await request('availability-creations' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('availabilityCreations'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`${change.operation}, caregiver ${change.proposed.CaregiverID}: ${change.state}. ${change.proposed.FromDate || 'Permanent week'} ${change.proposed.ToDate || ''}`), paragraph(`Reason: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));
      for (const day of ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']) card.append(paragraph(`${day}: ${change.proposed[day+'AvailabilityType']}, live in ${change.proposed[day+'LiveIn']}, ${change.proposed[day+'From']} to ${change.proposed[day+'To']}`));
      const call = async (action, extra = {}) => { await request('availability-creations/' + action, { id: change.id, revision: change.revision, ...extra }); await loadAvailabilityCreations(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck new availability', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved', 'rejected']) card.append(button('New availability ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Submit new availability once', async () => { if (window.confirm('Submit this new availability record to HHA once?')) await call('execute'); }); submit.disabled = !availabilityCreationWrites.includes(change.operation); card.append(submit); }
      } else if (change.execution) { card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile new availability (read only)', () => call('reconcile'))); }
      if (change.state === 'approved') card.append(recoveryControls(change, 'availability_create', loadAvailabilityCreations));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older new availability reviews', () => loadAvailabilityCreations(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadAvailabilityCreations').addEventListener('click', () => action(() => loadAvailabilityCreations()));
  $('patientNoteForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingPatientNoteId ||= crypto.randomUUID();
    await request('patient-notes/prepare', { id: pendingPatientNoteId, patientId: $('patientNotePatient').value, reasonId: $('patientNoteReasonId').value, note: $('patientNoteText').value, rationale: $('patientNoteReason').value });
    pendingPatientNoteId = null; await loadPatientNotes(); message('Internal patient note proposal saved. Source recheck and independent review are required.');
  }); });
  async function loadPatientNotes(cursor) {
    const data = await request('patient-notes' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('patientNoteChanges'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`Patient ${change.proposed.PatientID}: ${change.state}. Internal operational note, no email recipients.`), paragraph(`Reason: ${change.proposed.ReasonName} (vendor status ${change.proposed.ReasonStatus || 'unknown'}). Note: ${change.proposed.Note}`), paragraph(`Review rationale: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}. Recent-note review begins ${change.proposed.SinceUTC}; this is not full note history.`));
      const call = async (action, extra = {}) => { await request('patient-notes/' + action, { id: change.id, revision: change.revision, ...extra }); await loadPatientNotes(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck internal patient note', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved', 'rejected']) card.append(button('Internal patient note ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Submit internal patient note once', async () => { if (window.confirm('Submit this internal patient note without email recipients to HHA once?')) await call('execute'); }); submit.disabled = !patientNoteWritesEnabled; card.append(submit); }
      } else if (change.execution) { card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile internal patient note (read only)', () => call('reconcile'))); }
      if (change.state === 'approved') card.append(recoveryControls(change, 'patient_note', loadPatientNotes));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older internal patient note reviews', () => loadPatientNotes(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadPatientNotes').addEventListener('click', () => action(() => loadPatientNotes()));
  $('medicalCreationForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingMedicalCreationId ||= crypto.randomUUID();
    await request('medical-creations/prepare', { id: pendingMedicalCreationId, caregiverId: $('medicalCreationCaregiver').value, medicalId: $('medicalCreationMedical').value, dueDate: $('medicalCreationDue').value, authorityReference: $('medicalCreationAuthority').value, rationale: $('medicalCreationReason').value });
    pendingMedicalCreationId = null; await loadMedicalCreations(); message('Medical due item proposal saved. Source recheck and independent review are required.');
  }); });
  async function loadMedicalCreations(cursor) {
    const data = await request('medical-creations' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('medicalCreations'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`Caregiver ${change.proposed.CaregiverID}: ${change.state}. Medical requirement ${change.proposed.MedicalName}, due ${change.proposed.DueDate}.`), paragraph(`Creates a due item only, with no performed date, result or attachment. Authority reference: ${change.authorityReference}. Reason: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));

      const call = async (action, extra = {}) => { await request('medical-creations/' + action, { id: change.id, revision: change.revision, ...extra }); await loadMedicalCreations(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck medical due item', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved', 'rejected']) card.append(button('Medical due item ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Submit medical due item change once', async () => { if (window.confirm('I verified the medical requirement and due date against the authority reference. Create this due item in HHA once?')) await call('execute'); }); submit.disabled = !medicalCreationWritesEnabled; card.append(submit); }
      } else if (change.execution) { card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile medical due item (read only)', () => call('reconcile'))); }
      if (change.state === 'approved') card.append(recoveryControls(change, 'medical_create', loadMedicalCreations));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older medical due item reviews', () => loadMedicalCreations(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadMedicalCreations').addEventListener('click', () => action(() => loadMedicalCreations()));
  $('patientClinicalForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingPatientClinicalId ||= crypto.randomUUID();
    await request('patient-clinical/prepare', { id: pendingPatientClinicalId, patientId: $('patientClinicalPatient').value, comments: $('patientClinicalComments').value, authorityReference: $('patientClinicalAuthority').value, rationale: $('patientClinicalReason').value });
    pendingPatientClinicalId = null; await loadPatientClinicals(); message('Clinical comment proposal saved. Source recheck and independent review are required.');
  }); });
  async function loadPatientClinicals(cursor) {
    const data = await request('patient-clinical' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('patientClinicalChanges'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`Patient ${change.patientId}: ${change.state}. Comments: ${change.before.Comments} to ${change.proposed.Comments}.`), paragraph(`Allergies and nursing/MD settings are preserved. Authority reference: ${change.authorityReference}. Reason: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));

      const call = async (action, extra = {}) => { await request('patient-clinical/' + action, { id: change.id, revision: change.revision, ...extra }); await loadPatientClinicals(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck clinical comment', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved', 'rejected']) card.append(button('Clinical comment ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Submit clinical comment change once', async () => { if (window.confirm('I verified the clinical authority reference and the exact comment text. Submit this comment change to HHA once?')) await call('execute'); }); submit.disabled = !patientClinicalWritesEnabled; card.append(submit); }
      } else if (change.execution) { card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile clinical comment (read only)', () => call('reconcile'))); }
      if (change.state === 'approved') card.append(recoveryControls(change, 'patient_clinical', loadPatientClinicals));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older clinical comment reviews', () => loadPatientClinicals(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadPatientClinicals').addEventListener('click', () => action(() => loadPatientClinicals()));
  $('patientContractForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingPatientContractId ||= crypto.randomUUID();
    await request('patient-contracts/prepare', { id: pendingPatientContractId, patientId: $('patientContractPatient').value, date: $('patientContractDate').value, recordId: $('patientContractRecord').value, altPatientId: $('patientContractAlt').value, rationale: $('patientContractReason').value });
    pendingPatientContractId = null; await loadPatientContracts(); message('Contract identity proposal saved. Source recheck and independent review are required.');
  }); });
  async function loadPatientContracts(cursor) {
    const data = await request('patient-contracts' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('patientContractChanges'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`Patient ${change.patientId}, contract placement ${change.recordId}: ${change.state}. As of ${change.date}.`), paragraph(`Alternate patient ID: ${change.before.AltPatientID} to ${change.proposed.AltPatientID}. Primary status preserved: ${change.before.IsPrimaryContract}. Service dates and codes remain unchanged.`), paragraph(`Reason: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));
      const call = async (action, extra = {}) => { await request('patient-contracts/' + action, { id: change.id, revision: change.revision, ...extra }); await loadPatientContracts(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck contract identity', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved', 'rejected']) card.append(button('Contract identity ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Submit contract identity change once', async () => { if (window.confirm('Submit this alternate patient ID change to HHA once?')) await call('execute'); }); submit.disabled = !patientContractWritesEnabled; card.append(submit); }
      } else if (change.execution) { card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile contract identity (read only)', () => call('reconcile'))); }
      if (change.state === 'approved') card.append(recoveryControls(change, 'patient_contract', loadPatientContracts));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older contract identity reviews', () => loadPatientContracts(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadPatientContracts').addEventListener('click', () => action(() => loadPatientContracts()));
  async function readReplacementFile(input) {
    const initiatingGeneration = generation;
    const file = input.files?.[0]; if (!file || !file.size || file.size > 2 * 1024 * 1024) throw new Error('Select a nonempty file no larger than 2 MiB.');
    const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('File could not be read.')); reader.readAsDataURL(file); });
    if (initiatingGeneration !== generation) throw new Error('Session changed while reading the file. Start this action again.');
    return { filename: file.name, base64 };
  }
  $('documentCreationForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    const initiatingGeneration = generation; pendingDocumentCreationId ||= crypto.randomUUID(); const file = await readReplacementFile($('documentCreationFile'));
    await request('document-creations/prepare', { id: pendingDocumentCreationId, userRole: $('documentCreationRole').value, subjectId: $('documentCreationSubject').value, referenceDocumentId: $('documentCreationDocument').value, ...file, description: $('documentCreationDescription').value, rationale: $('documentCreationReason').value }, initiatingGeneration);
    pendingDocumentCreationId = null; await loadDocumentCreations(); message('Attachment creation proposal saved. Source recheck and independent review are required.');
  }); });
  async function loadDocumentCreations(cursor) {
    const data = await request('document-creations' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('documentCreationChanges'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`${change.userRole} ${change.subjectId}: ${change.state}. New file ${change.proposed.FileName}, ${change.proposed.FileBytes} bytes. SHA-256: ${change.proposed.FileSHA256}.`), paragraph(`Document type ${change.proposed.DocumentTypeID}, verified using existing document ${change.referenceDocumentId}. Description: ${change.proposed.Description}. Reason: ${change.rationale}. Source: ${change.sourceCheck}.`));

      const fileLabel = document.createElement('label'); fileLabel.textContent = 'Select the exact replacement file for independent review or submission (maximum 2 MiB)'; const reviewFile = document.createElement('input'); reviewFile.type = 'file'; fileLabel.append(reviewFile); card.append(fileLabel);

      const call = async (action, extra = {}) => { const initiatingGeneration = generation; if (action === 'execute' || action === 'review' && extra.decision === 'approved') extra.base64 = (await readReplacementFile(reviewFile)).base64; await request('document-creations/' + action, { id: change.id, revision: change.revision, ...extra }, initiatingGeneration); await loadDocumentCreations(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck attachment creation', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved', 'rejected']) card.append(button('Attachment creation ' + decision, async () => { if (decision !== 'approved' || window.confirm('I independently reviewed this exact file, description and document type. Approve creation?')) await call('review', { decision }); }));
        if (change.state === 'approved') { const submit = button('Submit attachment creation change once', async () => { if (window.confirm('Create this reviewed attachment in HHA once with the displayed document type and description?')) await call('execute'); }); submit.disabled = !documentCreationWrites.includes(change.operation); card.append(submit); }
      } else if (change.execution) { card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile attachment creation (read only)', () => call('reconcile'))); }
      if (change.state === 'approved') card.append(recoveryControls(change, 'document_create', loadDocumentCreations));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older attachment creation reviews', () => loadDocumentCreations(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadDocumentCreations').addEventListener('click', () => action(() => loadDocumentCreations()));
  $('collectionNoteForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingCollectionNoteId ||= crypto.randomUUID();
    await request('collection-notes/prepare', { id: pendingCollectionNoteId, ...Object.fromEntries(['patientId','visitId','contractId','reasonId','representativeId','collectionStatusId','claimStatusId','nonPaymentReasonId','followUpRepresentativeId','followupDate','note','authorityReference','rationale'].map(key => [key, $('collectionNote_' + key).value])) });
    pendingCollectionNoteId = null; await loadCollectionNotes(); message('Collection note proposal saved for independent review.');
  }); });
  async function loadCollectionNotes(cursor) {
    const data = await request('collection-notes' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('collectionNoteChanges'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`Patient ${change.proposed.PatientID}, visit ${change.proposed.VisitID}, contract ${change.proposed.ContractID}: ${change.state}.`), paragraph(`Proposed reason: ${change.proposed.Reason}; representative: ${change.proposed.ColRep}; collection status: ${change.proposed.CollectionStatus}; claim status: ${change.proposed.ClaimStatusName}; non-payment reason: ${change.proposed.NonPaymentName}; follow-up representative: ${change.proposed.CollectionFollowUpRep}; follow-up date: ${change.proposed.FollowupDate}.`), paragraph(`Note: ${change.proposed.Notes}`), paragraph(`Existing returned status evidence (up to 20 notes; not a current claim ledger): ${change.before.PriorStatusEvidence}`), paragraph(`Authority: ${change.authorityReference}. Reason: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));
      const call = async (action, extra = {}) => { await request('collection-notes/' + action, { id: change.id, revision: change.revision, ...extra }); await loadCollectionNotes(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck collection note', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved','rejected']) card.append(button('Collection note ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Submit collection note once', async () => { if (window.confirm('I reviewed the billed visit, authority and every proposed claim/collection/follow-up field. Submit this collection note once?')) await call('execute'); }); submit.disabled = !collectionNoteWritesEnabled; card.append(submit); }
      } else if (change.execution) card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile collection note (read only)', () => call('reconcile')));
      if (change.state === 'approved') card.append(recoveryControls(change, 'collection_note', loadCollectionNotes));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older collection note reviews', () => loadCollectionNotes(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadCollectionNotes').addEventListener('click', () => action(() => loadCollectionNotes()));
  $('linkedScheduleCreationForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingLinkedScheduleCreationId ||= crypto.randomUUID();
    await request('linked-schedule-creations/prepare', { id: pendingLinkedScheduleCreationId, patientId: $('linkedSchedulePatient').value, caregiverId: $('linkedScheduleCaregiver').value, payCodeId: $('linkedSchedulePay').value, serviceCodeId: $('linkedScheduleService').value, date: $('linkedScheduleDate').value, startTime: $('linkedScheduleStart').value, endTime: $('linkedScheduleEnd').value, authorityReference: $('linkedScheduleAuthority').value, rationale: $('linkedScheduleReason').value });
    pendingLinkedScheduleCreationId = null; await loadLinkedScheduleCreations(); message('Linked schedule proposal saved for independent review.');
  }); });
  async function loadLinkedScheduleCreations(cursor) {
    const data = await request('linked-schedule-creations' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('linkedScheduleCreations'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`Non-skilled linked schedule: patient ${change.proposed.PatientID}, caregiver ${change.proposed.CaregiverID}, ${change.proposed.VisitDate} ${change.proposed.ScheduleStartTime}-${change.proposed.ScheduleEndTime} office time. Pay ${change.proposed.PayCodeID} (${change.proposed.PayCodeName}); service ${change.proposed.ServiceCodeID} (${change.proposed.ServiceCodeName}); office ${change.officeId}. ${change.state}.`), paragraph(`Authority: ${change.authorityReference}. Reason: ${change.rationale}. Source: ${change.sourceCheck}. Persisted schedule type is not returned by the vendor; returned-field matches are partial; production submission and applied recovery are blocked pending an independent evidence verifier. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));
      const call = async (action, extra = {}) => { await request('linked-schedule-creations/' + action, { id: change.id, revision: change.revision, ...extra }); await loadLinkedScheduleCreations(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck linked schedule', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved','rejected']) card.append(button('Linked schedule ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Submit linked schedule once', async () => { if (window.confirm('I verified assignment, authorization coverage, service and pay codes, office-local times and agency notification behavior. Create this schedule once?')) await call('execute'); }); submit.disabled = !linkedScheduleCreationWritesEnabled; card.append(submit); }
      } else if (change.execution) card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile linked schedule (read only)', () => call('reconcile')));
      if (change.state === 'approved') card.append(recoveryControls(change, 'linked_schedule_create', loadLinkedScheduleCreations));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older linked schedule reviews', () => loadLinkedScheduleCreations(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadLinkedScheduleCreations').addEventListener('click', () => action(() => loadLinkedScheduleCreations()));
  $('referralCreationForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingReferralCreationId ||= crypto.randomUUID();
    await request('referral-creations/prepare', { id: pendingReferralCreationId, name: $('referralCreationName').value, typeId: $('referralCreationType').value, authorityReference: $('referralCreationAuthority').value, rationale: $('referralCreationReason').value });
    pendingReferralCreationId = null; await loadReferralCreations(); message('Inactive referral source proposal saved for independent review.');
  }); });
  async function loadReferralCreations(cursor) {
    const data = await request('referral-creations' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('referralCreations'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`Inactive referral source ${change.proposed.Name}, type ${change.proposed.ReferralSourceType}; office ${change.proposed.OfficeName}. ${change.state}.`), paragraph(`Authority: ${change.authorityReference}. Reason: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));
      const call = async (action, extra = {}) => { await request('referral-creations/' + action, { id: change.id, revision: change.revision, ...extra }); await loadReferralCreations(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck inactive referral source', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved','rejected']) card.append(button('Inactive referral source ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Submit inactive referral source once', async () => { if (window.confirm('I reviewed this source, office and source type. Create an inactive referral source once?')) await call('execute'); }); submit.disabled = !referralCreationWritesEnabled; card.append(submit); }
      } else if (change.execution) card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile inactive referral source (read only)', () => call('reconcile')));
      if (change.state === 'approved') card.append(recoveryControls(change, 'referral_create', loadReferralCreations));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older inactive referral source reviews', () => loadReferralCreations(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadReferralCreations').addEventListener('click', () => action(() => loadReferralCreations()));
  $('contractCreationForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingContractCreationId ||= crypto.randomUUID();
    await request('contract-creations/prepare', { id: pendingContractCreationId, patientId: $('contractCreationPatient').value, contractId: $('contractCreationContract').value, serviceCodeId: $('contractCreationService').value, startDate: $('contractCreationStart').value, altPatientId: $('contractCreationAlternate').value, authorityReference: $('contractCreationAuthority').value, rationale: $('contractCreationReason').value });
    pendingContractCreationId = null; await loadContractCreations(); message('Secondary contract proposal saved for independent review.');
  }); });
  async function loadContractCreations(cursor) {
    const data = await request('contract-creations' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('contractCreations'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`Patient ${change.proposed.PatientID}: secondary contract ${change.proposed.ContractID} (${change.proposed.ContractName}), service ${change.proposed.ServiceCodeID} (${change.proposed.ServiceCodeName}), effective ${change.proposed.StartDate}; alternate ID ${change.proposed.AltPatientID}. ${change.state}.`), paragraph(`Authority: ${change.authorityReference}. Reason: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));
      const call = async (action, extra = {}) => { await request('contract-creations/' + action, { id: change.id, revision: change.revision, ...extra }); await loadContractCreations(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck secondary contract', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved','rejected']) card.append(button('Secondary contract ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Submit secondary contract once', async () => { if (window.confirm('I reviewed coverage authority, payer, service and start date. Add this secondary contract once?')) await call('execute'); }); submit.disabled = !contractCreationWritesEnabled; card.append(submit); }
      } else if (change.execution) card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile secondary contract (read only)', () => call('reconcile')));
      if (change.state === 'approved') card.append(recoveryControls(change, 'contract_create', loadContractCreations));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older secondary contract reviews', () => loadContractCreations(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadContractCreations').addEventListener('click', () => action(() => loadContractCreations()));
  $('caregiverPictureForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    const initiatingGeneration = generation; pendingCaregiverPictureId ||= crypto.randomUUID(); const file = await readReplacementFile($('caregiverPictureFile'));
    await request('caregiver-pictures/prepare', { id: pendingCaregiverPictureId, caregiverId: $('caregiverPictureSubject').value, ...file, retainedOriginalReference: $('caregiverPictureArchive').value, rationale: $('caregiverPictureReason').value }, initiatingGeneration);
    pendingCaregiverPictureId = null; await loadCaregiverPictures(); message('Caregiver picture proposal saved. Source recheck and independent review are required.');
  }); });
  async function loadCaregiverPictures(cursor) {
    const data = await request('caregiver-pictures' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('caregiverPictureChanges'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`Caregiver ${change.caregiverId}: ${change.state}.`), paragraph(`File: ${change.before.FileName} (${change.before.FileBytes} bytes) to ${change.proposed.FileName} (${change.proposed.FileBytes} bytes). Original SHA-256: ${change.before.FileSHA256}. Replacement SHA-256: ${change.proposed.FileSHA256}.`), paragraph(`Retained original: ${change.retainedOriginalReference}. Reason: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));
      const fileLabel = document.createElement('label'); fileLabel.textContent = 'Select the exact replacement file for independent review or submission (maximum 2 MiB)'; const reviewFile = document.createElement('input'); reviewFile.type = 'file'; fileLabel.append(reviewFile); card.append(fileLabel);

      const call = async (action, extra = {}) => { const initiatingGeneration = generation; if (action === 'execute' || action === 'review' && extra.decision === 'approved') extra.base64 = (await readReplacementFile(reviewFile)).base64; await request('caregiver-pictures/' + action, { id: change.id, revision: change.revision, ...extra }, initiatingGeneration); await loadCaregiverPictures(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck caregiver picture', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved', 'rejected']) card.append(button('Caregiver picture ' + decision, async () => { if (decision !== 'approved' || window.confirm('I independently reviewed this exact file and verified the retained original reference. Approve replacement?')) await call('review', { decision }); }));
        if (change.state === 'approved') { const submit = button('Submit caregiver picture change once', async () => { if (window.confirm('I verified the retained original and reviewed this exact replacement file. Replace the HHA caregiver picture once?')) await call('execute'); }); submit.disabled = !caregiverPictureWritesEnabled; card.append(submit); }
      } else if (change.execution) { card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile caregiver picture (read only)', () => call('reconcile'))); }
      if (change.state === 'approved') card.append(recoveryControls(change, 'caregiver_picture', loadCaregiverPictures));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older caregiver picture reviews', () => loadCaregiverPictures(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadCaregiverPictures').addEventListener('click', () => action(() => loadCaregiverPictures()));
  $('documentReplacementForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    const initiatingGeneration = generation; pendingDocumentReplacementId ||= crypto.randomUUID(); const file = await readReplacementFile($('documentReplacementFile'));
    await request('document-replacements/prepare', { id: pendingDocumentReplacementId, userRole: $('documentReplacementRole').value, subjectId: $('documentReplacementSubject').value, documentId: $('documentReplacementDocument').value, ...file, retainedOriginalReference: $('documentReplacementArchive').value, rationale: $('documentReplacementReason').value }, initiatingGeneration);
    pendingDocumentReplacementId = null; await loadDocumentReplacements(); message('Attachment replacement proposal saved. Source recheck and independent review are required.');
  }); });
  async function loadDocumentReplacements(cursor) {
    const data = await request('document-replacements' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('documentReplacementChanges'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`${change.userRole} ${change.subjectId}, document ${change.documentId}: ${change.state}.`), paragraph(`File: ${change.before.FileName} (${change.before.FileBytes} bytes) to ${change.proposed.FileName} (${change.proposed.FileBytes} bytes). Original SHA-256: ${change.before.FileSHA256}. Replacement SHA-256: ${change.proposed.FileSHA256}.`), paragraph(`Retained original: ${change.retainedOriginalReference}. Reason: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));
      const fileLabel = document.createElement('label'); fileLabel.textContent = 'Select the exact replacement file for independent review or submission (maximum 2 MiB)'; const reviewFile = document.createElement('input'); reviewFile.type = 'file'; fileLabel.append(reviewFile); card.append(fileLabel);

      const call = async (action, extra = {}) => { const initiatingGeneration = generation; if (action === 'execute' || action === 'review' && extra.decision === 'approved') extra.base64 = (await readReplacementFile(reviewFile)).base64; await request('document-replacements/' + action, { id: change.id, revision: change.revision, ...extra }, initiatingGeneration); await loadDocumentReplacements(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck attachment replacement', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved', 'rejected']) card.append(button('Attachment replacement ' + decision, async () => { if (decision !== 'approved' || window.confirm('I independently reviewed this exact file and verified the retained original reference. Approve replacement?')) await call('review', { decision }); }));
        if (change.state === 'approved') { const submit = button('Submit attachment replacement change once', async () => { if (window.confirm('I verified the retained original and reviewed this exact replacement file. Replace the HHA attachment once, preserving its document type and description?')) await call('execute'); }); submit.disabled = !documentReplacementWrites.includes(change.operation); card.append(submit); }
      } else if (change.execution) { card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile attachment replacement (read only)', () => call('reconcile'))); }
      if (change.state === 'approved') card.append(recoveryControls(change, 'document_replacement', loadDocumentReplacements));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older attachment replacement reviews', () => loadDocumentReplacements(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadDocumentReplacements').addEventListener('click', () => action(() => loadDocumentReplacements()));
  $('documentMetadataForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingDocumentMetadataId ||= crypto.randomUUID();
    await request('document-metadata/prepare', { id: pendingDocumentMetadataId, userRole: $('documentMetadataRole').value, subjectId: $('documentMetadataSubject').value, documentId: $('documentMetadataDocument').value, description: $('documentMetadataDescription').value, rationale: $('documentMetadataReason').value });
    pendingDocumentMetadataId = null; await loadDocumentMetadatas(); message('Document description proposal saved. Source recheck and independent review are required.');
  }); });
  async function loadDocumentMetadatas(cursor) {
    const data = await request('document-metadata' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('documentMetadataChanges'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`${change.userRole} ${change.subjectId}, document ${change.documentId}: ${change.state}.`), paragraph(`Description: ${change.before.Description} to ${change.proposed.Description}. File preserved: ${change.before.FileName}, ${change.before.FileBytes} bytes, SHA256 ${change.before.FileSHA256}.`), paragraph(`Reason: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));
      const call = async (action, extra = {}) => { await request('document-metadata/' + action, { id: change.id, revision: change.revision, ...extra }); await loadDocumentMetadatas(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck document description', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved', 'rejected']) card.append(button('Document description ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Submit document description change once', async () => { if (window.confirm('Submit this document description change with the identical attachment bytes to HHA once?')) await call('execute'); }); submit.disabled = !documentMetadataWrites.includes(change.operation); card.append(submit); }
      } else if (change.execution) { card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile document description (read only)', () => call('reconcile'))); }
      if (change.state === 'approved') card.append(recoveryControls(change, 'document_metadata', loadDocumentMetadatas));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older document description reviews', () => loadDocumentMetadatas(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadDocumentMetadatas').addEventListener('click', () => action(() => loadDocumentMetadatas()));
  $('documentTypeForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    pendingDocumentTypeId ||= crypto.randomUUID();
    await request('document-types/prepare', { id: pendingDocumentTypeId, userRole: $('documentTypeRole').value, documentId: $('documentTypeDocument').value, recordId: $('documentTypeRecord').value, name: $('documentTypeName').value, status: $('documentTypeStatus').value, rationale: $('documentTypeReason').value });
    pendingDocumentTypeId = null; await loadDocumentTypes(); message('Document type proposal saved. Source recheck and independent review are required.');
  }); });
  async function loadDocumentTypes(cursor) {
    const data = await request('document-types' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('documentTypeChanges'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`${change.userRole} document type ${change.recordId}: ${change.state}. This change applies to the shared type.`), paragraph(`Name: ${change.before.DocumentType} → ${change.proposed.DocumentType}. Status: ${change.before.Status} → ${change.proposed.Status}. Description preserved: ${change.before.Description}`), paragraph(`Reason: ${change.rationale}. Source: ${change.sourceCheck}. Requested by ${change.requestedBy}; reviewer ${change.reviewedBy || 'Pending'}.`));
      const call = async (action, extra = {}) => { await request('document-types/' + action, { id: change.id, revision: change.revision, ...extra }); await loadDocumentTypes(); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck document type', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved', 'rejected']) card.append(button('Document type ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Submit document type change once', async () => { if (window.confirm('Submit this shared document type name/status change to HHA once?')) await call('execute'); }); submit.disabled = !documentTypeWritesEnabled; card.append(submit); }
      } else if (change.execution) { card.append(paragraph(`Submission: ${change.execution.result}; reconciliation: ${change.execution.reconciliation}.`), button('Reconcile document type (read only)', () => call('reconcile'))); }
      if (change.state === 'approved') card.append(recoveryControls(change, 'document_type', loadDocumentTypes));
      target.append(card);
    }
    if (data.nextCursor) { const more = button('Load older document type reviews', () => loadDocumentTypes(data.nextCursor)); more.dataset.more = 'true'; target.append(more); }
  }
  $('loadDocumentTypes').addEventListener('click', () => action(() => loadDocumentTypes()));
  function recoveryControls(proposal, family, reload) {
    if (family === 'linked_schedule_create') return paragraph('Linked schedule recovery is blocked: no supported independent verifier for persisted schedule type is integrated. A checkbox or case-reference string is not proof. Keep the lock and use an authorized vendor investigation; do not resubmit.');
    if (proposal.execution?.result === 'not_submitted') return paragraph('No vendor request was sent. This attempt is closed; prepare and independently review a new proposal when the service is available.');
    const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Recover a blocked source target'; details.append(summary);
    details.append(paragraph('This records verified operational evidence and releases only this proposal’s lock. It never submits or repeats an HHA change. First obtain vendor confirmation that the request completed or cannot still apply, and runtime evidence that its worker has terminated. A second administrator must independently verify both records. Elapsed time and matching source values alone are insufficient. Do not paste patient data or credentials.'));
    const r = proposal.recovery;
    if (r) {
      details.append(paragraph(`Recovery: ${r.state}; outcome: ${r.outcome}; prepared by ${r.requestedBy}. Vendor evidence: ${r.vendorCaseReference}. Worker evidence: ${r.runtimeTerminationReference}. ${r.confirmedScheduleType ? "Vendor-confirmed persisted schedule type: " + r.confirmedScheduleType : ""}`));
      details.append(button(r.state === 'resolved' ? 'Finish verified lock release' : 'Independently verify and resolve', async () => {
        if (!window.confirm('I independently verified the vendor completion evidence and termination of the submitting worker. Resolve this proposal permanently and release its matching lock after a fresh source check?')) return;
        await request('write-recovery/approve', { family, id: proposal.id, revision: proposal.revision }); await reload(); message('Recovery recorded. The original proposal cannot submit again.');
      }));
    } else {
      const form = document.createElement('form'); form.className = 'operational-form';
      const field = (title, element) => { const label = document.createElement('label'); label.textContent = title; label.append(element); form.append(label); return element; };
      const outcome = document.createElement('select');
      for (const [value, title] of [['', 'Select verified outcome'], ['applied', 'Vendor confirms applied'], ['not_applied', 'Vendor confirms not applied / cannot still apply']]) { const option = document.createElement('option'); option.value = value; option.textContent = title; outcome.append(option); }
      outcome.required = true; field('Verified vendor outcome', outcome);
      const vendor = field('Vendor case / completion evidence reference', document.createElement('input'));
      const runtime = field('Worker termination evidence reference', document.createElement('input'));
      for (const input of [vendor, runtime]) { input.required = true; input.minLength = 8; input.maxLength = 500; }
      const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'btn secondary'; submit.textContent = 'Prepare recovery for independent review'; form.append(submit);
      form.addEventListener('submit', event => { event.preventDefault(); action(async () => { if (family === 'linked_schedule_create' && outcome.value === 'applied' && !window.confirm('Does the vendor case independently confirm that this exact created visit has persisted schedule type Non-Skilled? Returned visit fields alone do not confirm this.')) return; await request('write-recovery/prepare', { family, id: proposal.id, revision: proposal.revision, outcome: outcome.value, ...(family === 'linked_schedule_create' && outcome.value === 'applied' ? { confirmedScheduleType: 'Non-Skilled' } : {}), vendorCaseReference: vendor.value, runtimeTerminationReference: runtime.value }); await reload(); message('Recovery evidence saved. Another administrator must verify it. No lock was released.'); }); });
      details.append(form);
    }
    return details;
  }
  async function loadAvailability(cursor) {
    const data = await request('availability-proposals' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    const target = $('availabilityChanges'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-older-availability]')?.remove();
    for (const change of data.changes) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`${change.operation} · caregiver ${change.caregiverId} · record ${change.recordId} · ${change.state}`));
      card.append(paragraph(`Requested by ${change.requestedBy}. Source check: ${change.sourceCheck}. Reason: ${change.rationale}`));
      for (const key of Object.keys(change.proposed)) if (change.proposed[key] !== change.before[key]) card.append(paragraph(`${key}: ${change.before[key] ?? 'Unknown'} → ${change.proposed[key] ?? 'Unknown'}`));
      const call = async (action, extra = {}) => { await request('availability-proposals/' + action, { id: change.id, revision: change.revision, ...extra }); await loadAvailability(); message('Availability review updated. Inspect the recorded source and execution state.'); };
      if (!change.execution && !change.recovery) {
        card.append(button('Recheck availability source', () => call('recheck')));
        if (change.state === 'pending_review') for (const decision of ['approved', 'rejected']) card.append(button('Availability ' + decision, () => call('review', { decision })));
        if (change.state === 'approved') { const submit = button('Submit approved availability once', async () => { if (window.confirm('Submit this independently approved availability change to HHA once?')) await call('execute'); }); submit.disabled = !availabilityWrites.includes(change.operation); card.append(submit); }
      } else if (change.execution) {
        card.append(paragraph(`Submission: ${change.execution.result}. Reconciliation: ${change.execution.reconciliation}. No repeat submission is allowed.`));
        card.append(button('Reconcile availability (read only)', () => call('reconcile')));
      }
      if (change.state === 'approved') card.append(recoveryControls(change, 'availability', loadAvailability));
      target.append(card);
    }
    if (data.nextCursor) { const older = button('Load older availability reviews', () => loadAvailability(data.nextCursor)); older.dataset.olderAvailability = 'true'; target.append(older); }
  }
  $('loadAvailability').addEventListener('click', () => action(() => loadAvailability()));
  $('staffingReviewForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    $('staffingEvidence').replaceChildren();
    const data = await request('staffing-review', { patientId: $('staffingPatient').value, officeId: $('staffingOffice').value, date: $('staffingDate').value, caregiverIds: $('staffingCaregivers').value.split(',').map(value => value.trim()) });
    const target = $('staffingEvidence'); target.append(paragraph(`Evidence fetch ${data.state}. Eligibility not determined; no ranking or assignment applied. ${data.warning}`));
    for (const item of data.evidence) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`${item.subject}: ${item.operation}`));
      if (item.error) card.append(paragraph('Evidence unavailable: ' + item.error.replaceAll('_', ' ')));
      else {
        card.append(paragraph(`Fetched ${item.source.fetchedAt}. ${item.source.truncated ? 'Truncated source result; completeness unknown.' : 'Source records remain unvalidated.'}`));
        if (!item.source.records.length) card.append(paragraph('No records returned; availability and eligibility remain unknown.'));
        for (const record of item.source.records) { const dl = document.createElement('dl'); for (const [key, value] of Object.entries(record)) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = key; dd.textContent = value ?? 'Not supplied / unknown'; dl.append(dt, dd); } card.append(dl); }
      }
      target.append(card);
    }
    message(`Staffing evidence ${data.state}. Review unresolved evidence before making an assignment in the source system.`);
  }); });
  async function loadInvestigations(cursor) {
    const result = await request('investigations' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')); investigations = cursor ? [...investigations, ...result.investigations] : result.investigations;
    const target = $('investigationList'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    if (!cursor) target.append(paragraph('Investigations load 100 per page. Follow-up dates identify overdue work; no automatic escalation is enabled. Refresh to include recent changes.'));
    for (const item of result.investigations) {
      const card = document.createElement('article'); card.className = 'panel';
      card.append(paragraph(`${item.title} · Visit ${item.visitId} · ${item.status} · Assigned: ${item.assignee || 'Unassigned'}${item.followUpAt ? ` · Follow-up ${item.followUpAt}${Date.parse(item.followUpAt) < Date.now() && item.status !== 'resolved' ? ' (overdue)' : ''}` : ''}`));
      for (const e of item.events) card.append(paragraph(`${e.at} · ${e.actor} · ${e.action}: ${e.note}`));
      card.append(button('Update investigation', async () => { $('investigationId').value = item.id; $('investigationRevision').value = item.revision; $('investigationVisit').value = item.visitId; $('investigationTitle').value = item.title; $('investigationAssignee').value = item.assignee; $('investigationStatus').value = item.status; $('investigationFollowUp').value = item.followUpAt || ''; $('investigationNote').value = ''; $('investigationTitle').focus(); })); target.append(card);
    }
    if (!investigations.length) target.append(paragraph('No investigations recorded.'));
    if (result.nextCursor) { const more = button('Load older investigations', () => loadInvestigations(result.nextCursor)); more.dataset.more = ''; target.append(more); }
    message('Investigation queue loaded.');
  }
  $('loadInvestigations').addEventListener('click', () => action(loadInvestigations));
  $('newInvestigation').addEventListener('click', () => { $('investigationForm').reset(); $('investigationRevision').value = 0; });
  $('investigationForm').addEventListener('submit', event => { event.preventDefault(); action(async () => {
    if (!$('investigationId').value) $('investigationId').value = crypto.randomUUID();
    await request('investigations', { id: $('investigationId').value, revision: Number($('investigationRevision').value || 0), visitId: $('investigationVisit').value, title: $('investigationTitle').value, assignee: $('investigationAssignee').value, status: $('investigationStatus').value, followUpAt: $('investigationFollowUp').value || null, note: $('investigationNote').value });
    $('investigationForm').reset(); await loadInvestigations(); message('Investigation saved with append-only history and audit event.');
  }); });
  async function loadIntents(cursor) {
    const result = await request('intents' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')); intents = cursor ? [...intents, ...result.intents] : result.intents; const target = $('intentList'); if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    for (const item of result.intents) { const card = document.createElement('article'); card.className = 'panel'; card.append(paragraph(`${item.kind} · ${item.preparation ? 'Caregiver ' + item.preparation.caregiverId : 'Visit ' + item.visitId} · ${item.state}`), paragraph(`Reason: ${item.rationale}`), paragraph(`Proposed: ${item.proposed}`), paragraph(`Requested by ${item.requestedBy}; reviewer ${item.reviewedBy || 'Pending'}. Execution requires its separate deployment gate; generic visit/schedule proposals cannot execute.`));
      if (item.preparation) {
        const p = item.preparation;
        card.append(paragraph(`Source hourly rate: ${p.before.HourlyRate ?? 'Unknown'}; proposed: ${p.proposedHourlyRate}. Source check: ${p.sourceCheck}; checked: ${p.checkedAt || 'Not yet'}.`));
        card.append(paragraph(`Preserved source fields: from ${p.before.FromDate ?? 'Unknown'} to ${p.before.ToDate ?? 'Unknown'}; daily ${p.before.DailyRate ?? 'Unknown'}; visit ${p.before.VisitRate ?? 'Not supplied'}; status ${p.before.Status ?? 'Unknown'}; patient ${p.before.PatientID ?? 'Not supplied'}.`));
        if (!item.execution && !item.recovery) {
          card.append(button('Recheck source rate', async () => { await request('rate-proposals/recheck', { id: item.id, revision: item.revision }); await loadIntents(); message('Source recheck recorded. Review its status before approval. No HHA write occurred.'); }));
          if (item.state === 'approved') {
            const submit = button('Submit approved hourly-rate change once', async () => { if (!window.confirm('Submit this approved hourly-rate change to HHA once? Review the before/proposed rate and preserved fields above. A timeout will require reconciliation, not another submission.')) return; await request('rate-proposals/execute', { id: item.id, revision: item.revision }); await loadIntents(); message('Submission attempt recorded. Inspect its acknowledgement and source reconciliation; no automatic retry is permitted.'); });
            submit.disabled = !writesEnabled; card.append(submit);
          }
        } else if (item.execution) {
          card.append(paragraph(`Submission: ${item.execution.result}. Source reconciliation: ${item.execution.reconciliation}. A matching source value does not by itself prove which request changed it. No repeat submission is available.`));
          card.append(button('Reconcile source after submission', async () => { await request('rate-proposals/reconcile', { id: item.id, revision: item.revision }); await loadIntents(); message('Source reconciliation recorded without another write.'); }));
        }
      }
      if (item.state === 'approved' && item.preparation) card.append(recoveryControls(item, 'rate', loadIntents));
      if (item.state === 'pending_review') for (const state of ['approved', 'rejected', 'cancelled']) card.append(button(state, async () => { await request('intents', { id: item.id, revision: item.revision, state }); await loadIntents(); message('Review recorded. No HHA write occurred.'); })); target.append(card); }
    if (!intents.length) target.append(paragraph('No change requests recorded.'));
    if (result.nextCursor) { const more = button('Load older change requests', () => loadIntents(result.nextCursor)); more.dataset.more = ''; target.append(more); }
  }
  $('rateProposalForm').addEventListener('submit', event => { event.preventDefault(); action(async () => { pendingRateId ||= crypto.randomUUID(); await request('rate-proposals', { id: pendingRateId, caregiverId: $('rateCaregiver').value, rateId: $('rateId').value, hourlyRate: $('rateAmount').value, rationale: $('rateRationale').value }); pendingRateId = null; $('rateProposalForm').reset(); await loadIntents(); message('Source-backed rate proposal saved. Recheck and independent review are required; source submission remains separately gated.'); }); });
  $('loadIntents').addEventListener('click', () => action(loadIntents));
  $('intentForm').addEventListener('submit', event => { event.preventDefault(); action(async () => { pendingIntentId ||= crypto.randomUUID(); await request('intents', { id: pendingIntentId, revision: 0, visitId: $('intentVisit').value, kind: $('intentKind').value, rationale: $('intentRationale').value, proposed: $('intentProposed').value }); pendingIntentId = null; $('intentForm').reset(); await loadIntents(); message('Change request saved for independent review. Approval does not execute it in HHA.'); }); });
  async function loadAudit(cursor) {
    const result = await request('audit' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '')), target = $('workspaceAudit');
    if (!cursor) target.replaceChildren(); else target.querySelector('[data-more]')?.remove();
    target.append(...result.events.map(event => paragraph(`${event.updatedAt} · ${event.actor} · ${event.action} · revision ${event.revision}`)));
    if (result.nextCursor) { const more = button('Load older audit events', () => loadAudit(result.nextCursor)); more.dataset.more = ''; target.append(more); }
    message('Audit events loaded, 100 per page. Refresh to include recent changes.');
  }
  $('loadWorkspaceAudit').addEventListener('click', () => action(loadAudit));
  document.querySelectorAll('[data-workflow]').forEach(control => control.addEventListener('click', () => {
    const workflow = control.dataset.workflow;
    if (workflow === 'audit') return action(loadAudit);
    if (workflow === 'investigations') return action(loadInvestigations);
    if (workflow === 'settings') { $('ownerForm').closest('details').open = true; $('ownerOffice').focus(); return; }
    selectRead(workflow);
    if (workflow === 'SearchPatients' || workflow === 'SearchCaregivers') $('readTerm').focus(); else $('readDate').focus();
    message('Workflow selected. Supply the requested identifiers or date, then read source records.');
  }));
  if (!document.getElementById('appShell')?.hidden) action(loadSettings);
})();
