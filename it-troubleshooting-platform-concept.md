# IT Fundamentals & Troubleshooting Platform — Working Concept

## Origin & Vision

Started as an interactive troubleshooting *game* (an idea originally built out in a Claude Code session that got lost between devices). On reflection, the game is better framed as one module within a larger platform — in the same spirit as the Misfire Arcade / rosettaskeys.com work already out there, but built as a "learn by doing" curriculum for real-world IT/ITOps rather than as standalone games.

The gap this is aimed at: schools and bootcamps have increasingly shifted toward cloud-native curricula where the underlying mechanics (subnetting, DNS, DHCP, directory replication, event logs) are abstracted away behind a portal UI. That produces technicians who can click through a console but can't reason from a vague symptom ("it's slow," "I can't log in") to a root cause, and who don't reflexively check logs, firmware, or basic diagnostic commands before escalating or guessing.

The platform's job is to teach both the *mechanism* (how DHCP/DNS/AD/etc. actually work, not as a diagram but as commands and log lines you'd see in the field) and the *methodology* (how to reason from symptom to cause), and to test the second using the first — the troubleshooting game becomes the proving ground, not the whole product.

## Difficulty & Placement (resolves the audience question)

Rather than picking one target audience, borrow the hardness-tier pattern already used in the Misfire Arcade games: let the tech self-select a difficulty tier. In a game that's self-explanatory, but for ITOps content the stakes of guessing wrong are higher — bored-and-checked-out on one end, overwhelmed-and-quitting on the other — and self-assessment is unreliable, since plenty of techs meaningfully under- or over-estimate themselves.

**The fix for that unreliability**: don't ask people to rate themselves — self-report is exactly the biased signal being corrected for. Instead, run a short *behavioral* placement check: show a handful of real symptoms/error strings and ask "what's your first move," then recommend a starting tier from what they actually reach for rather than what they claim their level is. Closer to a language-app placement test than a self-assessment survey.

**Tiers map to actual technique, not just word count**:
- **Less-seasoned tier** — surfaces the simpler symptom-identification layer first: `ipconfig`, `ping`, `gpresult`, Event Viewer at a glance, the GUI-visible checks. Goal is building the instinct to check *something* systematically before guessing.
- **Veteran tier** — goes straight to packet captures and raw protocol-level digging, skipping the beginner scaffolding entirely.
- Both tiers teach the same underlying lesson: usually the answer is somewhere in the logs — but sometimes everything is silent (Signal vs. Silence, Bucket 1) or the log is technically present but presents the error in a misleading form (the "label lies to you" pattern from the 401/403 case). The veteran tier isn't a different methodology, it's the same taxonomy applied one layer of abstraction lower.
- **Tiering should be per-module, not global.** Someone can place as a veteran in networking fundamentals and a beginner in AD/GPO, especially given how specialized real IT careers get — a single global difficulty setting would misplace a lot of genuinely skilled people outside their specialty.

## Content Architecture — Three Pillars

1. **Labs** — teach mechanism. Configure a DHCP scope, watch a lease expire, watch a client fall back to APIPA. The system tells you what actually happened every time. Goal: build the correct mental model through direct cause-and-effect.
2. **Cases** — test methodology. Withhold the diagnosis; make the learner reconstruct the causal chain from symptoms alone, often under simulated time/resource pressure. The system reveals the answer only once the learner commits. This is the "troubleshooting game" layer.
3. **Classification Drills** — a lighter-weight third type that emerged from this discussion. Short, sharp exercises that show a real, verbatim error string with no other context and force the learner to classify it (e.g., authentication vs. authorization vs. account-state; "no response" vs. "explicit rejection" vs. "bad value") before any further information is revealed. Targets literal reading comprehension as its own skill, separate from protocol knowledge — the failure mode this fixes is pattern-matching on a keyword and jumping to a remembered fix instead of parsing what's actually printed on the screen.

## Cross-Cutting Concepts

These should be taught once, early, and referenced from every domain module rather than re-derived per-protocol.

### Signal vs. Silence (the recurring triage move)
The single most repeated pattern in this whole conversation. Any failure indication falls into one of three buckets:
1. **No answer at all** — ambiguous, multi-causal, tells you nothing about the target's actual health yet (ping timeout, SNMP -2003/"no response," a flat RADIUS "Access-Reject," an LDAP appliance whose entire auth path is dead).
2. **An explicit rejection/error** — real signal, but not necessarily about health (ICMP "destination host unreachable" from an intermediate router; SNMP "No Such Object"; HTTP 403).
3. **A successful answer that's simply bad** — the only case where "go fix the underlying thing" is actually the correct next step (SNMP value over threshold, HTTP 200 with a slow TTFB).
Worth naming and teaching explicitly before any individual protocol module, since it recurs in ping, DNS, DHCP, SNMP, HTTP, RADIUS, and LDAP.

**Why silence happens is itself worth diagnosing, and splits into two different explanations that call for different next moves.** Sometimes silence means you're investigating the wrong OSI layer or the wrong failure domain entirely — the system genuinely believes it's fine from its own vantage point, or it's logging the event somewhere you haven't looked yet. Other times, especially in consumer/prosumer-abstracted gear (see the UniFi-class case below), silence just reflects how much the vendor decided the tech needed to see — the device may have a real problem its alerting logic was never designed to surface at all. When neither checking a different log nor understanding the abstraction gap gets you anywhere, the only remaining move is direct behavioral observation over time — see below.

### Eventual Consistency
On-prem AD replication and cloud identity (Entra/Intune) are the *same construct* wearing different vendor names. See the propagation pipeline table below. The instinct to distrust "did it replicate/sync yet" before distrusting the policy logic itself is the same skill regardless of platform.

### Fail-Open vs. Fail-Closed
A design choice, not a bug, but one that produces confusing symptoms if you don't know it's happening. Example: a DHCP server on a domain controller that can't verify its own AD authorization at boot (because AD DS itself isn't fully up yet) fails *closed* — treats "couldn't verify" the same as "not authorized" — even though the proof of authorization is sitting on the same disk. Same shape as SPF's `-all` (hard fail) vs. `~all` (soft fail) policy choice.

### Trust-Boundary Flattening
The more intermediaries a request crosses, the less diagnostic detail survives to the client — often deliberately, for security reasons (e.g., collapsing "account locked" vs. "wrong password" vs. "policy denied" into one generic "access denied" over VPN/RADIUS prevents account enumeration by an attacker). The lesson: when the client-visible symptom is uninformative, that's not a dead end, it's a cue to go to the source-of-truth log on the server/appliance itself.

## Named Diagnostic Methodology

- **Half-splitting / binary search** — pick a midpoint, test it, discard half the remaining hypothesis space. Origin: electronics/radar fault isolation, transfers cleanly to computer systems — same discipline, different test points (voltage/continuity → command output/log line).
- **Substitution** — swap in a variable known to be good (a known-good account, a second machine, a different DC/resolver) and see whether the failure follows the swap or stays put. This showed up independently across nearly every real playbook shared in this conversation — arguably the most-used move in practice.
- **Top-down vs. bottom-up traversal** — work from the application layer down, or the physical layer up, depending on what's cheapest to check first.
- **"What changed"** — establish the last known-good state before touching anything; most real root causes are a delta, not a mystery. Caveat: some failures (stale replication, a certificate hitting its expiry date, a service race condition) have no proximate human "change" at all — worth teaching as an explicit exception to this method.
- **Symptom vs. root cause** — a reboot or reimage can "fix" something without anyone learning why; design cases where the quick fix works temporarily and the failure recurs later.
- **Behavioral/temporal observation** — when a tool gives no explicit signal at all (no alert, no log line, nothing to half-split against), the only remaining move is watching state change over time and inferring the fault from the pattern of change itself. There's nothing to read here, only something to watch — a genuinely different move from every other method on this list.
- **Classify before you diagnose** — sort an error into a category (authn/authz/account-state; signal/silence/bad-value) before acting on it. This is the drill-type exercise, distinct from a full case.

## AI Fluency (a load-bearing meta-skill)

This closes the loop on a bullet from the very first sketch of this platform — "what context is pertinent to give the tech's AI or Google search" — by turning it into a full skill rather than a one-line item.

**The core failure mode**: a tech in a high-uncertainty troubleshooting state pastes a vague symptom into an AI (or search engine) and either gets back a single confident-sounding guess they implement without testing, or a list of generic possibilities with no way to actually check any of them. Both waste time — the second one is arguably worse, since it looks helpful without being actionable.

**The better pattern — the pull-prompt**: instead of asking for an answer, ask the AI to interview you. A prompt shaped like *"Don't propose a fix yet. Ask me one diagnostic question at a time to narrow this down, and for each one, tell me exactly how to check the answer — the specific command, log, or tool — since I may not already know how to test it"* turns the AI into a differential-diagnosis partner instead of an oracle. Same half-splitting discipline as everywhere else in this doc, just applied to a conversation instead of a wire or a directory.

**The key discipline, and the one techs actually lack**: it's not enough for the AI to ask a good narrowing question — "is this happening for one user or all of them" is useless to someone who doesn't know *how* to check that. A good pull-prompt interaction pairs every question with a concrete verification method ("ask two other people at the same site to try the same thing, or check whether a shared resource like a mapped drive is also affected"). Teaching techs to notice when a question is unpaired with a check, and to explicitly demand the pairing, is the actual skill here — the underlying "where does this evidence live" knowledge is exactly what the rest of this platform's domain modules are for, which is why this can't be a standalone module; it's what makes the other modules usable in the moment they're actually needed.

**Other components worth naming explicitly**:
- **Feed it evidence incrementally.** The loop only works if the tech reports back what they found after each check, letting the AI narrow further from real data instead of reasoning from an increasingly stale initial description.
- **Give it scope and capability up front** — role, access level, available tooling (RMM, packet capture, admin rights, remote-hands-only) — so it doesn't waste turns suggesting things that aren't actually possible for that tech in that moment.
- **Paste verbatim, not paraphrase.** An AI reasoning from "it says something about a trust issue" is reasoning from already-lossy information — the same "teach a tech to read" problem from the authn/authz section applies to what gets fed *into* the AI, not just what a system prints on screen.
- **Treat the AI's hypothesis exactly like a search-result hypothesis, never a verdict.** An AI can produce a confident, well-written, wrong answer with the same shape as a forum post that matches the symptom but not the actual cause — a direct extension of the anti-easter-egging design principle below. A case type could use a simulated AI suggestion as the plausible near-miss instead of (or alongside) a fake KB article; the "win" is the same either way — verify against the live system before acting, don't implement on confidence alone.
- **Know when the loop isn't worth it.** For something acute — production down, need hands on keyboard right now — a multi-turn interview can cost more than it saves versus just checking the two or three most likely things directly. This pattern earns its keep specifically in the "lot of unknown, don't know where to start" state it's designed for.

Worth noting for the record: this section describes, almost exactly, the interaction pattern this entire conversation followed to arrive at this document — narrowing an ambiguous, evolving idea through iterative questioning and verification-oriented follow-up. That's not incidental; it's arguably the cleanest available worked example of the skill, and could be adapted (anonymized) as an actual sample case for this module.

## Home Lab / Experimentation Track

Aimed at technicians with either a paid AI subscription or a locally-run/open-source model (Ollama, LM Studio, etc.) who want a low-stakes place to try agentic AI against real IT infrastructure before it ever goes near a corporate or client environment. Breaking your own home network carries a completely different risk profile than breaking a client's production environment or violating an MSP's data-handling policy — that gap in acceptable risk is real and worth designing for explicitly, not glossed over.

**The content gap this addresses**: the internet already has abundant tutorials for agentic AI building apps, automations, and dev-shaped projects. There's very little aimed at "poke this IT-shaped thing" — applying an agent to real network gear, directory services, or monitoring stacks rather than to code. That's the same abstraction-skew problem the whole platform opened with, just showing up again at the tooling-adoption layer instead of the curriculum layer.

**Responsible vs. effective — and why effective is the harder bar.** Whether an agent *can* reach into IT infrastructure is already settled; public tooling proves that, so it's not the interesting question. The two worth actually investigating are how to do it responsibly (the easier of the two — dry-run/confirm gates, audit logs, risk tiers are largely known patterns borrowed from ops/security) and how to do it effectively, which is the real test: if it doesn't measurably increase value over doing the diagnosis without it, there's no point pursuing further. One design constraint worth keeping fixed while investigating this: host the MCP server locally/offline rather than through a third-party-hosted service — a hosted MCP is one more trust boundary to be wary of, consistent with the scope-of-trust checklist below, just applied to the experimenter's own setup before anyone else's.

**Possible content shape**:
- Setting up a local/open-source LLM and connecting it to a home-lab MCP server (personal network gear, a home AD lab VM, etc.) for private, offline practice — no data leaving the house.
- A deliberately-broken home-lab sandbox (a VM or VLAN) where the *agent* — not the learner — introduces the fault, picking from a menu of realistic scenarios (a VLAN-scoped loop, a saturated DHCP pool, a misconfigured DNS forwarder, an expired cert) without telling the learner which one. Breaking something yourself leaves residual knowledge that no real ticket ever provides — having the agent do it restores genuine blindness, much closer to how an actual incident arrives. Offer **both** modes rather than resolving it to one: **Guided** — the same agent that injected the fault stays in the loop, so it can scaffold hints and validate a hypothesis against ground truth it already holds, a good fit for a first exposure to a given fault type or for someone placed at the less-seasoned tier — and **Blind** — a fresh instance with no memory of the injection, full realism, no safety net, the graduation step once Guided mode's been cleared for that fault type. Not an either/or, a progression, and it pairs naturally with the difficulty tiers above.
- An explicit checklist on scope of trust before any of this leaves the home lab: what data an MCP connector actually shares, why real client credentials or topology shouldn't go near a cloud AI without organizational sign-off, and the habits of caution worth having already built before ever proposing this kind of tooling at work.
- Framed honestly as a bridge, not just a hobby corner: it's how an individual tech builds genuine hands-on experience with agent-assisted IT ops somewhere mistakes are safe, so there's something real to point to if the day comes to advocate for this kind of tooling organizationally.

**Reading a packet capture with AI help.** There's a mechanical point before the conceptual one: a raw `.pcap`/`.pcapng` file is binary, and most AI tools can't parse it directly — a tech needs to extract a text slice first (e.g. `tshark -r capture.pcapng -Y "bootp || dns" -T fields -e frame.time -e ip.src -e ip.dst`), which already requires enough filter syntax to narrow the extract to the relevant conversation. That filtering step is itself half-splitting — the haystack gets reduced before the AI ever sees it, not after.

The conceptual point is the harder one, and the one worth naming directly: an AI (or a person) staring at a huge capture can't spot an anomaly without a stated baseline of what's *supposed* to be happening — which endpoint should be talking to which, over what protocol, roughly how often. Call this **baseline articulation**: being able to say "the client should get a DHCPOFFER back from 10.0.4.5 within a couple retries" is itself a diagnostic skill, and it's entirely gated on already having the mechanism knowledge from the relevant domain module. This sub-skill isn't really a new AI trick — it's the AI-fluency module and the protocol-mechanism modules meeting in the middle: the tech supplies the expected topology and protocol context, the AI helps comb the reduced extract for violations of it.

**Browser console logs.** A genuinely distinct literacy gap for a lot of ITOps people, since most were never taught how a web page actually works — the client-server request model, what loads what, what a given console error is actually asserting. A console log can look like nonsense to someone who lives in IP addresses and DNS records, and worse, it can get misclassified in either direction: dismissed as "an app problem, not mine" when it's actually infrastructure, or blamed on "the network" when it's application code. A few concrete anchors worth teaching:
- A CORS error usually means a backend header misconfiguration — but it can also be caused by an SSL-inspecting corporate proxy rewriting the response, which loops straight back into the certificate-chain material earlier in this doc. Recognizing "this might be my proxy, not their app" is the valuable move.
- A mixed-content warning (an HTTP resource loading on an HTTPS page) is usually leftover from an incomplete HTTPS migration — the browser silently blocks it, and the page just looks subtly broken with no obvious error unless the console is open.
- `net::ERR_CONNECTION_REFUSED` / "Failed to fetch" is squarely IT-ops territory — an actual connectivity failure, and worth teaching as the one entry in this list that reliably means "go network-troubleshoot," where the others mostly don't.
- A certificate warning surfacing in the console ties directly back to the SSL/TLS case material above.

Same "classify before you diagnose" move from the authn/authz section, applied to a domain ITOps traditionally never gets taught at all: sort console output into "mine to fix," "escalate to the dev team," or "actually my infrastructure wearing a web-shaped disguise" — before reflexively shrugging it off or trying to fix something that was never a network problem. Both of these (packet captures and console logs) are also legitimate Lab and Classification Drill content in their own right, independent of AI — the AI-assisted angle is an accelerant once the underlying literacy exists, not a substitute for building it.

## Design Principles / Mechanics

- **Anti-easter-egging**: some cases should include a plausible-but-wrong top search result or KB article — right symptom, wrong root cause, or right for a different version — so the "win" condition is verifying against the live system rather than trusting the first write-up that matches.
- **Score process separately from outcome**: did the learner gather enough evidence before proposing a cause, change one variable at a time, confirm the fix addressed the actual mechanism — scored independently of whether they landed on the right answer. Right-answer-by-luck should not score the same as right-answer-by-process.
- **Version/vendor drift as content, not noise**: the same failure can present differently across OS versions (the DHCP authorization race needing "Delayed Start" on Server 2008 vs. an explicit service dependency now) or vendors (Barracuda's specific auth-service-hang behavior, PRTG's specific -2003 code). Leaning toward teaching the underlying mechanism as timeless and explicitly calling out version/vendor drift as its own teaching point, rather than pinning cases to one version and treating drift as a footnote.
- **Authentic field texture over sanitized textbook scenarios**: the specificity of real incidents (a co-located DC/DHCP box refusing to authorize itself, a Barracuda grudge, the "really Joe?" reaction) is what differentiates this from CompTIA-style content and is worth deliberately protecting in how cases get written.
- **RMM/out-of-band tooling as a first-class diagnostic capability**: an RMM agent typically runs independent of AD auth, so it can gather evidence (`nltest`, event logs) even when the affected user can't log in at all — worth teaching explicitly, since the instinct "I can't log in, therefore I can't check anything" is simply false once this tool is known.

## Domain Modules & Case Material Gathered So Far

### Networking Fundamentals — DHCP
- **Not leasing → APIPA fallback**: packet capture on `DHCPDISCOVER` shows whether any offer comes back at all. Zero offers → relay/`ip helper-address` problem upstream, not the DHCP server itself. Classic trap: an unsaved switch config reverting a helper address after an unrelated reboot, breaking a VLAN's DHCP with no recent "change" visible.
- **Pool exhaustion**: renewal is unicast, fresh leases are broadcast — a saturated pool can look fine for days (existing devices keep renewing) until something needs a brand-new lease. Check via `Get-DhcpServerv4ScopeStatistics`.
- **ARP/"bad address" conflicts**: two distinct root causes with identical symptoms — a static IP living inside the dynamic pool range (server doesn't know it's taken unless excluded), vs. a client not renewing correctly and the server reissuing its "expired" lease to someone else. Disambiguate by comparing the DHCP server's lease table against what's actually answering ARP on the wire.
- **DHCP authorization race condition** (on a box that's both a DC and a DHCP server): DHCP Server service can start before NTDS is ready to answer the AD query that proves authorization; the check fails closed. Documented as Event ID 1059. Fix: `DependOnService = NTDS` registry value on the DHCPServer service. Older OS versions (Server 2008-era) were commonly worked around with Delayed Start instead — a blunter, timing-based fix vs. the explicit dependency.
- **DHCP server authorization** as a security gate is also the flip side of the "rogue DHCP server" problem: a legitimate, unauthorized-by-mistake server can sit healthy and silently refuse to lease, while a rogue server has no such restriction and answers everything.

### Networking Fundamentals — DNS
- **Split-brain/split-horizon divergence**: internal resolver chain resolves correctly, but the public record is wrong. Diagnose by querying internal DNS directly vs. a resolver with no relation to your network (`nslookup host internal-dns-ip` vs. `nslookup host 8.8.8.8`).
- **Registrar nameserver changes**: propagation window is governed by per-record TTL and caching resolvers worldwide — nothing forces it faster. Records not manually recreated at a new provider (MX, SPF, DKIM, misc. verification TXT records) just silently vanish. Mitigation: pull a full zone inventory from the old provider *before* cutover.
- **SSL/TLS "not expired but invalid"** — at least five distinct root causes presenting identically: expired intermediate CA in the chain, client clock skew, SNI misconfiguration serving the wrong cert, hostname/SAN mismatch, and revocation. `openssl s_client -connect host:443 -servername host` shows the actual chain and verify result.

### Email Authentication (SPF/DKIM/DMARC)
- **SPF**: hard 10-DNS-lookup ceiling; each SaaS tool's `include:` eats into it; crossing the limit causes a `PermError` that fails mail for everyone, not just the newest addition.
- **DKIM**: rarely breaks except on DNS moves (selector record not recreated) or provider key rotation.
- **DMARC**: usually fails on *alignment*, not the record itself — a third-party sender passing SPF/DKIM for its own domain while the visible `From:` header shows the client's domain.
- Correction for the record: Google/Yahoo's bulk sender authentication requirements (SPF+DKIM+DMARC, one-click unsubscribe) kick in at **5,000 emails/day**, not 500 — in effect since February 2024. A lower "500/day" threshold, if real in a given environment, is likely an ESP/relay-specific tier, not the Google/Yahoo rule itself — which is itself a good case: a vendor's own quieter limit unrelated to the well-known public rule.

### Windows / Active Directory Domain Issues
- **"No trust relationship between this workstation and the primary domain"** = machine successfully reached a DC, but the secure channel/computer-account password is desynced. Fix: `Test-ComputerSecureChannel -Repair` or rejoin.
- **"The domain [x] is not available"** = machine never reached any DC at all — DNS, routing, or no DC reachable. Rejoining is close to useless advice here.
- **Combo case**: some users at a site log in slow but can't print, others get "domain not available" outright — both explained by **cached credentials**: users with a recent cached logon fall back to it (slow, and print still fails because it needs a live domain resource); users without one get a hard failure. Same root cause (site-wide connectivity/DC issue), two symptoms, explained entirely by per-machine logon history.
- **Improperly demoted DC**: metadata cleanup skipped, stale DNS SRV records left behind — some clients get referred to a dead DC while others land on a healthy one, producing "works for me" confusion.
- **DHCP being remote** from the affected site is strong corroborating evidence of a single WAN/VPN failure wearing multiple symptoms, rather than three unrelated tickets.

### Group Policy / Replication
- Policy delivering successfully from a healthy DC does not guarantee the *resources it references* are reachable — a hardcoded UNC path or GPP printer object pointing at a resource that lives at a different, unreachable site will still be slow/broken regardless of which DC served the policy.
- **Single dead printer in a GPP list** stalls processing on exactly that one item due to connection timeout, while the printer *object* itself is intact — diagnosed via the Group Policy Operational log / per-CSE timing, not by checking printer configuration.
- **DCLocator site-affinity caching**: a client can keep retrying a DC that just went down instead of failing over, because DCLocator caches the selected DC for a period. `nltest /dsgetdc:domain /force` forces fresh discovery. AD Sites/Subnets misconfiguration can also leave a client effectively "site-less," landing it on a suboptimal DC by design, not accident.
- **"Works here, doesn't work there"**: a GPO is really two independently-replicating things — the policy object (AD replication) and the policy files (SYSVOL, via DFSR/FRS). Compare GPO version numbers (`gpresult /h`, `Get-GPO`) across sites as the half-splitting move: matching versions rule out replication entirely and point at scope (OU membership, inheritance blocking, security/WMI filtering); mismatched versions confirm replication lag. OU moves are subject to the same replication lag.

### Cloud Identity — Entra ID & Intune ("same construct, different names")

| Stage | On-prem AD | Cloud (hybrid) |
|---|---|---|
| Directory write | AD attribute change | Same, on-prem |
| Inter-node propagation | DC-to-DC replication (`repadmin`) | Entra Connect delta sync — default every 30 min |
| Membership re-evaluation | — | Dynamic group re-evaluation — no published SLA |
| Policy delivery | SYSVOL (DFSR/FRS) | Intune push via WNS (usually minutes, but only for admin-initiated changes) |
| Client application | `gpupdate`, default ~90 min refresh + random offset | Device check-in — default 8 hrs; Config Refresh tunable to 30 min, default set to 90 min deliberately mirroring GPO |
| Session-level caching (separate from all of the above) | Kerberos TGT embeds group SIDs at logon time; stale until re-logon or ticket expiry | Primary Refresh Token can similarly outlive a directory change |

Key point: "it's assigned, why doesn't the user have it" can be failing at any of four-plus independent, differently-owned stages, and forcing a device sync only helps if the earlier stages have already finished.

### Monitoring Domains
Three-bucket taxonomy (an application of Signal vs. Silence above):
1. No response — ambiguous (ping timeout, SNMP error -2003 "no response," could be wrong credentials/version, blocked port, service down or bound to localhost only, restrictive ACL).
2. Target responded "I don't have that" — SNMP "No Such Object/Instance," usually a MIB/OID mismatch or a firmware upgrade that silently renumbered an OID.
3. Target responded fine, value is genuinely bad — the only bucket where fixing the underlying thing is the correct move.

Ping-specific nuances: "Request timed out" is genuinely ambiguous (5+ possible causes); "Destination host unreachable" is an explicit reply from an intermediate router (points at routing, not the target); "Destination port unreachable" on a UDP probe actually *proves host liveness*; "could not find host" never left the resolver stage at all.

Generalizes cleanly to HTTP monitoring (connection refused / DNS failure vs. a clean 404 or TLS handshake with wrong cert vs. a slow-but-200 or a 500) and to database/log-based monitoring.

### Authentication vs. Authorization
- Core distinction: authn = "are you who you say you are," authz = "given that, are you allowed to do this."
- Windows has a third category besides these two: **account state** (locked out, expired password) — often misread as a password problem, especially lockout, where retrying just extends the lockout window.
- **RADIUS/NPS is the sharpest example of the client learning nothing**: identical flat "denied" regardless of cause. Server-side Event ID 6273 Reason Code 16 = authentication failure (bad credentials); Reason Code 65 = authorization failure (valid credentials, but account/policy denies network access permission). Only the server log disambiguates.
- **HTTP 401 vs. 403 is a "the label lies to you" case**: 401 "Unauthorized" actually means *not authenticated*; 403 "Forbidden" is the one that actually means authorization failure. Careful reading of the word alone isn't enough here — you have to know the number means something different from what the English word implies.
- **File shares**: NTFS and share permissions are two independently-applied authorization layers; most-restrictive-of-the-two wins, and it's easy to check only one and declare victory.
- **"Teaching a tech to read"**: the real bottleneck isn't knowing the authn/authz definitions, it's pattern-matching on a keyword ("denied," "failed") and jumping to a remembered fix instead of parsing the specific string. This is the direct justification for the Classification Drill exercise type above.

### Remote Access / VPN-Specific Wrinkles
- **Trust-boundary flattening**: console logon is rich with detail by design (self-service); RDP/VPN/RADIUS collapse to flat "access denied" partly as deliberate security hygiene (prevents account enumeration from outside).
- **LDAP-auth VPN appliances** (non-RADIUS): simple bind vs. search-then-bind. AD embeds specific sub-error codes (disabled, expired, locked, logon-hours restricted) inside a generic "invalid credentials" LDAP response — but it's the *appliance vendor's* choice how much of that detail to surface.
- **The appliance's entire auth path being dead** is a distinct, more severe failure class: can't reach the DC at all, an expired LDAPS certificate on the DC (a silent, calendar-driven failure disconnected from any user's password activity), or — in search-then-bind setups — the appliance's *own* service account being expired/disabled/locked. In all of these, testing any individual user's password is pointless.
- **Diagnostic sequence**: substitute a known-good account through the identical path first (if it also fails, the problem is upstream of any individual credential); check the appliance's dedicated auth/debug log, not its connection/session log; run `ldapsearch` from a neutral host using the same service account to test directory health independent of what the appliance chooses to report.
- **Real vendor pattern (Barracuda)**: an MSAD reboot can cause the firewall's auth service to time out and *not self-recover* — it needs a manual service restart. General pattern: a service holding persistent state to an upstream dependency that doesn't detect the bounce and reconnect gracefully. Same shape as DCLocator caching a dead DC.
- **Windows Server 2025 planning note**: the "LDAP server signing requirements Enforcement" policy defaults to *Require Signing* on Server 2025 DCs (2019/2022/2016 defaulted to negotiable). This specifically breaks appliances doing a *simple, unsigned* bind over plain LDAP:389 — it does not strictly force full LDAPS, just signed LDAP (SASL) or LDAPS+channel binding. Worth confirming vendor support for LDAP signing ahead of any DC upgrade, since 2019/2022 remain widely viable in the meantime.

### Abstracted / Prosumer Networking Gear (UniFi-class)
A distinct failure mode from the AD/DNS/DHCP material above: not "the system is confused about its own state," but "the system knows less than it could, on purpose, because a product designer decided that's the right tradeoff for the target user." Consumer- and prosumer-oriented gear trades diagnostic depth for a simpler UI.

**Case: a loop confined to specific VLANs.** General loop-detection never fired, because the loop only existed within a subset of VLANs rather than presenting as a network-wide broadcast storm. The only route to finding it was watching the upstream switch's port/client mapping over time — devices confirmed present on the downstream switch would show up on port 5, then a few minutes later on port 17, repeatedly. That flapping between two ports in the forwarding table is the loop's actual fingerprint, visible only through direct observation, never through any alert the switch raised. An AI consulted at the time correctly suggested "a loop" fairly early — general diagnosis was cheap — but *finding* it required exactly the behavioral/temporal observation named above, which the AI had no visibility into. Side note, not a near-term plan: a local MCP connection to live switch state exists and could theoretically compress this kind of search, but it's currently scoped to a single home environment and not easily portable across different client networks — and it's a better architectural fit for Claude Code than for Claude's chat interface, since Code's local execution model suits an offline/local MCP more naturally than chat does. Genuinely interesting territory for an MSP down the road, contingent on the org actually extending coding-agent access to techs — not something to build the platform's near-term roadmap around.

### Real Field Playbooks (authenticity reference / raw case seeds)
- VPN-down tickets: first move is testing with an account known to be signed into other systems that same day — pure substitution.
- Mass slow logins: name resolves but unpingable → path/reachability issue; resolves and responds → identify which DC answered, then substitution-test a second machine.
- Access denied: `net user <username> /domain` first (cheap, checks expiration/lockout state immediately). Repeated intermittent lockouts → hunt the source of bad logons, keeping in mind lockout counting/Event 4740 centralizes at the PDC emulator — hunting tools need real domain-authenticated context, not SYSTEM, to be accurate.
- DHCP issues: locate the server, check pool exhaustion / service health / AD authorization status, in that order.
- DNS issues: compare what this server resolves against what another server resolves, then separately verify the resolved target is actually alive.

## Comparison Landscape (what's out there, and what each is actually good for)

Worth naming these explicitly rather than dismissing them — most are genuinely good at what they do, they just don't do *this*. The platform should be positioned as filling the gap between them, with explicit pointers toward them as continuing education once someone's built the underlying instinct here.

- **Packet Tracer / GNS3** — genuinely excellent for hands-on config repetition: real CLI syntax, building and breaking topologies without physical gear, seeing what a `show` command actually looks like on real device output. Falls short on narrative and sequencing — nothing tells you *why* you're doing an exercise, there's no ambiguous-symptom framing, and you already know what's broken because you broke it yourself, so it never builds diagnostic reasoning under uncertainty. **Fits as**: the natural next step after finishing a networking module here — once someone has the mental model and has practiced diagnosing it under uncertainty in a guided case, this is where they get raw repetition without training wheels.
- **TryHackMe / HackTheBox** — progressive difficulty done really well, real hands-on boxes, strong community walkthroughs, and it does teach a version of the same "poke at something to learn its state" instinct — just aimed at security. Falls short by assuming a security-adjacent baseline and never touching ops-level fundamentals (DHCP/DNS/AD troubleshooting) at all; the gamification is built around "solve this to get a flag," not "diagnose this vague complaint from a confused user." **Fits as**: a strong specialization path once fundamentals are solid and someone wants to lean toward security specifically.
- **CompTIA-style prep (A+/Network+/Security+)** — legitimately useful for vocabulary breadth and for passing a credential that hiring filters actually check for. Falls short because it tests recall under multiple choice, not process — someone can pass Network+ without ever having typed `nslookup`. **Fits as**: genuinely complementary rather than competing — CompTIA prep builds the vocabulary, this platform is where that vocabulary turns into applied instinct. Worth positioning this way explicitly rather than as a rival credential.
- **Human Resource Machine / TIS-100 (Zachtronics-style puzzle games)** — proof that a technical mental model can become a genuinely satisfying puzzle mechanic, closer to the intended feel than a straight simulator. Falls short on any connection to real tools, commands, or environments — nothing transfers directly to an actual ticket. **Fits as**: design inspiration for *how* to make a mechanic satisfying, not a source of transferable content.

## Open Design Questions
- Tech stack / delivery platform — not yet discussed in this thread.
- Version/vendor pinning strategy for cases — teach mechanism as timeless with drift as a named side-topic, vs. pinning specific versions per case.
- Scope — internal tool for a specific team/organization vs. broader public release.
- Placement-quiz content itself — the tier mechanism is decided; the actual set of behavioral placement scenarios still needs to be written.
