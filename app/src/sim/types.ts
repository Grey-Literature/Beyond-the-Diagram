// ---------- Static (catalog) definitions ----------
export type Face = 'front' | 'rear' | 'wall';

export type PortKind =
  | 'rj45' // copper ethernet jack
  | 'console' // RJ45 serial console
  | 'sfp' // SFP+ cage (10GbE)
  | 'stack' // switch stacking port
  | 'sc' // SC/APC single mode fiber
  | 'c13' // IEC C13 outlet (female, on PDU/UPS)
  | 'c14' // IEC C14 inlet (male, on PSU)
  | 'c19' // IEC C19 outlet
  | 'c20' // IEC C20 inlet
  | 'l530r' // NEMA L5-30 receptacle (wall)
  | 'l530p' // NEMA L5-30 input on UPS
  | 'nema515r' // consumer power-strip outlet (NEMA 5-15R)
  | 'dc' // DC barrel jack fed by a plug-in power brick
  | 'ebm' // external battery connector
  | 'keystone'; // patch panel keystone (front)

export type CableType =
  | 'cat6'
  | 'dac'
  | 'om4'
  | 'os2sc'
  | 'stack'
  | 'pwr13'
  | 'pwr19'
  | 'pwr530'
  | 'ebm'
  | 'brick';

export interface PortDef {
  id: string; // deviceId:name
  deviceId: string;
  name: string;
  label: string; // printed label
  kind: PortKind;
  face: Face;
  x: number; // local (device) coordinates of port centre on the face
  y: number;
  comp?: string; // component slot that carries this port (NIC, PSU, controller)
  poe?: boolean;
  role?: string; // human description
  vertical?: boolean;
}

export type CompKind =
  | 'drive'
  | 'dimm'
  | 'cpu'
  | 'fan'
  | 'psu'
  | 'nic'
  | 'hba'
  | 'raid'
  | 'lom'
  | 'bmc'
  | 'controller'
  | 'battery';

export interface CompDef {
  id: string;
  kind: CompKind;
  label: string;
  part: string; // plausible generic part description
  pos: [number, number, number]; // local position (centre)
  size: [number, number, number];
  hotSwap: boolean; // may be replaced while running
  access: 'front' | 'rear' | 'internal';
  needsShroudOff?: boolean;
  rot?: number;
}

export type DeviceType =
  | 'server2u'
  | 'server1u'
  | 'san'
  | 'switch'
  | 'firewall'
  | 'isp'
  | 'dumbswitch'
  | 'strip'
  | 'shelf'
  | 'patch'
  | 'tiepanel'
  | 'cablemgr'
  | 'ups'
  | 'ebm'
  | 'pdu'
  | 'blank'
  | 'wallpanel';

export interface DeviceDef {
  id: string;
  name: string;
  model: string;
  type: DeviceType;
  u: number; // bottom U (1-based). 0 for non-rack devices
  h: number; // height in U
  depth: number;
  width: number;
  serviceable: boolean; // on rails, lid removable
  ports: PortDef[];
  comps: CompDef[];
  side?: 'left' | 'right'; // PDUs
  /** Desktop gear sitting on a rack shelf rather than mounted in U space. */
  place?: { on: string; x: number; z?: number };
  /** Height in metres for non-rack-unit gear (shelf items). */
  boxH?: number;
  /** Which way the device's own front (its ports, for a switch) points. Default 'front'. */
  facing?: 'front' | 'rear';
  /** Default airflow, relative to the device's own front: f2b = intake at its front. */
  airflow?: Airflow;
}

export type Airflow = 'f2b' | 'b2f';

// ---------- Dynamic (persisted) state ----------
export interface CompState {
  installed: boolean;
  failed: boolean;
}

export interface DeviceState {
  /** Airflow of the fan/PSU kit actually installed, when it differs from the catalog default. */
  airflow?: Airflow;
  powerOn: boolean; // front power button / desired state
  extended: boolean;
  lidOff: boolean;
  shroudOff: boolean;
  comps: Record<string, CompState>;
}

export interface Cable {
  id: string;
  a: string;
  b: string;
  type: CableType;
  color: string;
  faulty?: boolean;
  /** Printed label flag on the cable, as a tech would have left it. Absent = unlabeled. */
  label?: string;
}

export interface SwitchPortCfg {
  mode: 'access' | 'trunk';
  vlan: number; // access vlan / native vlan
  allowed: number[]; // trunk allowed list
  enabled: boolean;
  errDisabled?: boolean;
  desc?: string;
}

export interface HostNetCfg {
  mgmtTag: number | null; // VLAN tag used for host management on 10G uplinks
  vmTag: number | null; // VLAN tag for VM port group
  clusterTag: number | null; // VLAN tag on LOM cluster team (null = untagged)
}

export interface SimState {
  version: number;
  scenarioId: string;
  rack: { frontDoorOpen: boolean; rearDoorOpen: boolean; leftPanelOff: boolean; rightPanelOff: boolean };
  devices: Record<string, DeviceState>;
  cables: Record<string, Cable>;
  swPorts: Record<string, SwitchPortCfg>;
  vlans: Record<number, string>;
  sanMap: Record<string, boolean>; // host id -> initiator allowed / LUNs presented
  fwPolicies: Record<string, boolean>;
  fwSubifs: number[];
  hostNet: Record<string, HostNetCfg>;
  maintenance: Record<string, boolean>; // cluster node paused + drained
  tieFaults: Record<string, boolean>; // rear tie-panel port id -> permanent link (punch-down) broken
  utilityOn: boolean;
  upsCharge: number; // 0..1
  pduBreaker: Record<string, boolean>;
  events: { t: number; msg: string; level: 'info' | 'warn' | 'error' }[];
}
