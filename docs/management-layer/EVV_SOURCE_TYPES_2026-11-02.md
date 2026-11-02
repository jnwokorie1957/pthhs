# EVV source-type fields — November 2, 2026 UTC

Status: implemented and tested; normal release and native acceptance pending.
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

After the normal release, select the already-inspected affected visit through
the existing API inspector and verify both raw field states alongside its exact
identity and unchanged clocks/hours. Compare additional historical/current-day
cases only when they resolve a specific source question. Keep source values and
identifiers in protected tools, retain only nonsensitive state evidence here,
and leave P03/E04 open if no usable endpoint is supplied.
