# EVV source-type fields — November 2, 2026 UTC

Status: deployed and accepted for this bounded raw source-field connection.
Remaining EVV endpoints and retained history are not completed by this change.

The captured public `hharefs/hha-wdsl.xml` defines ClockInEvvType and
ClockOutEvvType as optional strings on GetVisitInfoDetailsV3. The approved
GetVisitInfoV3 read omitted both from its projection. They are now preserved as
raw direct VisitInfo fields in the existing protected operational inspector.
TimeZone was already projected and is not a newly recovered field.

The same strict direct scalar reader used for visit time evidence preserves
exact text, explicit empty and zero. Missing, nil, nested, duplicate or
non-scalar paths remain unknown. A type field does not supply a clock, an event
ID, a patient/caregiver/visit join, accepted direction semantics or complete
retained history. No type value fills EVVEndTime or ActualHours. This does not
convert source timezones, calculate duration, classify an exception or make an
operational decision.

Two regressions fail before implementation and pass afterward. They cover exact
values, empty, zero, namespaced/CDATA strings, unproved paths and an explicit
empty EVV end beside a populated out-type field. All565backend tests pass.
Browser assets and the public catalog remain byte-current; there is no new
frontend payload property, field interpretation, source call or permission.
The existing V3 method remains subject to its current owner and office controls.

Runtime `bd16ce83a836ade938b4bc3f90167b769a37e535` passed all three normal jobs in
workflow41479943139: Hosting16:17:51, backend16:19:05, analytics16:19:29UTC.
Twelve exact deployed assets and nine anonymous401/private/no-store/noindex
boundaries passed16:19:45.714UTC. Concurrent patient-authorization UI changes
were preserved; Chrome loaded dashboard77a1e2f112c2.

The first exact V3 inspector read met a real saved read hold. The existing
integrationLimits/interactive_reads metadata record showed nextAllowedAt
16:21:00.333UTC. It was inspected read-only; no limit/hold was cleared or shortened.
At16:29:08UTC that boundary was already past. One retry returned one source record
matching the affected visit/patient/caregiver/date. ClockInEvvType was supplied,
ClockOutEvvType explicitly empty. Recorded endpoints and EVV start were supplied;
EVV end and both actual-hour fields were explicitly empty, matching prior states.

One contrasting October24 visit with both EVV endpoints was selected from the
same source page through existing Open records / Open visit read controls. The
independent V3 result matched its visit/patient/caregiver and supplied both type
fields, both EVV endpoints and both actual-hour fields. This establishes that
both newly projected fields can carry real source data. Empty versus populated
types remain independent of accepted direction semantics or a clinical decision.

No private identifier, clock, value or name is retained here. P10 is accepted;
P03/E04 retained-call coverage/linkage and genuinely empty endpoints stay open.
