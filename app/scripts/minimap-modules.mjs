// Mini-map content per module. Coordinates are px offsets from the map centre (600, 340) in a
// 1200 x 790 viewBox. Along the centre line the terraces are: 1 above y 360, 2 above 280,
// 3 above 200, and the Experiment ridge (4) from y 85 up to -195. Leaves sit on summits (5) on
// that ridge. Fork captions hang from labelAt (their top centre) so they can dodge the branches.
//
// Each module is one symptom split in half at every fork until one cause is left. Keep the forks
// honest: every question has to rule out half of what's still in play, and every leaf has to
// produce the same symptom the trail starts from.

export const modules = {
  dhcp: {
    seed: 11,
    home: [0, 402],
    homeNote: 'The root cause, written down.',
    trunk: [[0, 402], [4, 360], [5, 322], [-10, 275], [-15, 242], [0, 195], [15, 150], [10, 100], [0, 50]],
    waypoints: [
      { at: [5, 322], step: 1, stepName: '1 Ask', text: '“Everyone on VLAN 20 has a 169 address.”', side: 'right' },
      {
        at: [-15, 242], step: 2, stepName: '2 Research', side: 'left',
        text: 'What a 169.254 address means', href: 'lab-scope-lease-apipa.html',
        note: 'The Lab. The client gave up: no lease exchange ever finished.',
      },
      { at: [15, 150], step: 3, stepName: '3 Hypothesis', text: 'The exchange breaks somewhere between the client and the DHCP server.', side: 'right' },
    ],
    forks: [
      {
        at: [0, 50], labelAt: [0, -88],
        question: 'Does the DHCP server ever see the DISCOVER?',
        test: 'Capture on the server’s interface, or check the relay’s forwarding counters.',
      },
      {
        at: [-215, 10], labelAt: [-345, 26],
        question: 'Is the DISCOVER on the wire in VLAN 20?',
        test: 'Capture from any other port in VLAN 20. Broadcasts reach every port.',
      },
      {
        at: [215, 10], labelAt: [345, 26],
        question: 'Does the scope have free leases?',
        test: 'Get-DhcpServerv4ScopeStatistics',
      },
    ],
    branches: [
      { pts: [[0, 50], [-110, 60], [-215, 10]], routes: 'client relay', answer: 'No: it’s the path', answerAt: [-112, 84] },
      { pts: [[0, 50], [110, 60], [215, 10]], routes: 'pool auth', answer: 'Yes: it’s the server', answerAt: [112, 84] },
      { pts: [[-215, 10], [-285, -40], [-325, -86]], routes: 'client', answer: 'No', answerAt: [-292, -22] },
      { pts: [[-215, 10], [-150, -60], [-122, -130]], routes: 'relay', answer: 'Yes', answerAt: [-160, -40] },
      { pts: [[215, 10], [150, -60], [122, -130]], routes: 'pool', answer: 'No', answerAt: [160, -40] },
      { pts: [[215, 10], [285, -40], [325, -86]], routes: 'auth', answer: 'Yes', answerAt: [292, -22] },
    ],
    leaves: [
      { id: 'client', at: [-325, -95], name: 'The client or its access port', note: 'NIC or driver, a shut port, the wrong VLAN on the port.' },
      {
        id: 'relay', at: [-120, -140], name: 'The relay lost its ip helper-address', note: 'An unrelated switch reboot reverted an unsaved config.',
        href: 'case-apipa-fallback.html', kind: 'case', linkText: 'The Case ends here',
      },
      { id: 'pool', at: [120, -140], name: 'The pool is exhausted', note: 'Renewals are unicast, so it can look fine for days.' },
      {
        id: 'auth', at: [325, -95], name: 'The server refuses to lease', note: 'Not authorized in AD. It fails closed.',
        href: 'drill-dhcp-1059.html', kind: 'drill', linkText: 'The Drill: Event ID 1059',
      },
    ],
    descent: [[350, -92], [440, -70], [498, 40], [482, 220], [300, 372], [24, 404]],
    descentLabelAt: [420, 150],
  },
};
