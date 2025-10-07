export interface Server {
  id: string;
  name: string;
  type: ServerType;
  status: ServerStatus;
  port: number;
  directory: string;
  executable: string;
  arguments: string[];
  environmentVars: Record<string, string>;
  autoRestart: boolean;
  maxPlayers?: number;
  currentPlayers?: number;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  lastStarted?: Date;
  pid?: number;
  memory?: MemoryUsage;
  cpu?: number;
  uptime?: number;
  config: ServerConfig;
  backups: Backup[];
  plugins: Plugin[];
  mods: Mod[];
  logs: LogEntry[];
}

export enum ServerType {
  MINECRAFT_VANILLA = 'minecraft_vanilla',
  MINECRAFT_FORGE = 'minecraft_forge',
  MINECRAFT_FABRIC = 'minecraft_fabric',
  MINECRAFT_PAPER = 'minecraft_paper',
  MINECRAFT_SPIGOT = 'minecraft_spigot',
  MINECRAFT_BUKKIT = 'minecraft_bukkit',
  STEAM_GAME = 'steam_game',
  COUNTER_STRIKE = 'counter_strike',
  GARRY_MOD = 'garry_mod',
  TEAM_FORTRESS_2 = 'team_fortress_2',
  LEFT_4_DEAD_2 = 'left_4_dead_2',
  RUST = 'rust',
  ARK_SURVIVAL = 'ark_survival',
  VALHEIM = 'valheim',
  TERRARIA = 'terraria',
  SEVEN_DAYS_TO_DIE = '7_days_to_die',
  PROJECT_ZOMBOID = 'project_zomboid',
  PALWORLD = 'palworld',
  CUSTOM = 'custom'
}

export enum ServerStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  CRASHED = 'crashed',
  UPDATING = 'updating',
  BACKUP_IN_PROGRESS = 'backup_in_progress',
  RESTORING = 'restoring'
}

export interface ServerConfig {
  [key: string]: any;
  serverProperties?: Record<string, string | number | boolean>;
  startupParameters?: string[];
  javaArgs?: string[];
  memoryAllocation?: {
    min: string;
    max: string;
  };
  networking?: {
    port: number;
    queryPort?: number;
    rconPort?: number;
    rconPassword?: string;
  };
  world?: {
    name: string;
    seed?: string;
    gamemode?: string;
    difficulty?: string;
  };
  performance?: {
    maxPlayers: number;
    viewDistance: number;
    simulationDistance: number;
  };
}

export interface ServerTemplate {
  id: string;
  name: string;
  type: ServerType;
  description: string;
  version: string;
  downloadUrl?: string;
  steamAppId?: number;
  executable: string;
  defaultArgs: string[];
  defaultConfig: ServerConfig;
  ports: PortDefinition[];
  requirements: SystemRequirements;
  features: string[];
  installSteps: InstallStep[];
  configFiles: ConfigFile[];
}

export interface PortDefinition {
  name: string;
  port: number;
  protocol: 'TCP' | 'UDP';
  required: boolean;
  description: string;
}

export interface SystemRequirements {
  minMemory: string;
  recommendedMemory: string;
  minDiskSpace: string;
  supportedOS: string[];
}

export interface InstallStep {
  type: 'download' | 'extract' | 'execute' | 'copy' | 'edit';
  description: string;
  params: Record<string, any>;
}

export interface ConfigFile {
  path: string;
  type: 'properties' | 'json' | 'yaml' | 'ini' | 'txt';
  editable: boolean;
  description: string;
}

export interface Backup {
  id: string;
  serverId: string;
  name: string;
  type: 'manual' | 'scheduled' | 'pre_update';
  size: number;
  path: string;
  createdAt: Date;
  description?: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  downloadUrl: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface Mod {
  id: string;
  name: string;
  version: string;
  modLoader: 'forge' | 'fabric' | 'quilt';
  downloadUrl: string;
  enabled: boolean;
  dependencies: string[];
}

export interface LogEntry {
  id: string;
  serverId: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  source: 'server' | 'system' | 'user';
  message: string;
  metadata?: Record<string, any>;
}

export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  network: {
    interfaces: NetworkInterface[];
  };
  processes: ProcessInfo[];
}

export interface NetworkInterface {
  name: string;
  ip4: string;
  ip6?: string;
  mac: string;
  internal: boolean;
  rx: number;
  tx: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  serverId?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  createdAt: Date;
  lastLogin?: Date;
  active: boolean;
}

export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user'
}

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  serverId?: string;
  userId?: string;
  timestamp: Date;
  acknowledged: boolean;
  actions?: AlertAction[];
}

export interface AlertAction {
  id: string;
  label: string;
  action: string;
  params?: Record<string, any>;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  serverId?: string;
  userId?: string;
  timestamp: Date;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  supportedServerTypes: ServerType[];
  hooks: PluginHook[];
  config: PluginConfig;
}

export interface PluginHook {
  event: string;
  handler: string;
  priority: number;
}

export interface PluginConfig {
  schema: Record<string, any>;
  defaults: Record<string, any>;
}

export interface ServerQuery {
  online: boolean;
  players: {
    current: number;
    max: number;
    list?: string[];
  };
  map?: string;
  version?: string;
  ping?: number;
}