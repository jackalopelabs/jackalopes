/**
 * Game-related type definitions
 */

/**
 * Player types in the game
 */
export type PlayerType = 'merc' | 'jackalope';

/**
 * 3D Vector representation
 */
export type Vector3 = [number, number, number];

/**
 * Quaternion representation (x, y, z, w)
 */
export type Quaternion = [number, number, number, number];

/**
 * Player state information
 */
export interface PlayerState {
  position: Vector3;
  rotation: Quaternion;
  velocity?: Vector3;
  sequence: number;
  playerType: PlayerType;
  jumping?: boolean;
  running?: boolean;
  shooting?: boolean;
  timestamp: number;
}

/**
 * Shot event data
 */
export interface ShotEvent {
  shotId: string;
  origin: Vector3;
  direction: Vector3;
  player_id: string;
  playerType: PlayerType;
  timestamp: number;
}

/**
 * Respawn event data
 */
export interface RespawnEvent {
  player_id: string;
  requestedBy: string;
  spawnPosition?: Vector3;
  timestamp: number;
}

/**
 * Game event base interface
 */
export interface GameEvent {
  event_type: string;
  timestamp: number;
}

/**
 * Player shoot event
 */
export interface PlayerShootEvent extends GameEvent, ShotEvent {
  event_type: 'player_shoot';
}

/**
 * Player respawn event
 */
export interface PlayerRespawnEvent extends GameEvent, RespawnEvent {
  event_type: 'player_respawn';
}

/**
 * Player scored event
 */
export interface PlayerScoredEvent extends GameEvent {
  event_type: 'player_scored';
  player_id: string;
  points: number;
  target_id?: string;
}

/**
 * Player hit event
 */
export interface PlayerHitEvent extends GameEvent {
  event_type: 'player_hit';
  player_id: string;
  hit_by: string;
  damage: number;
}

/**
 * Union type of all game events
 */
export type GameEventData = 
  | PlayerShootEvent
  | PlayerRespawnEvent
  | PlayerScoredEvent
  | PlayerHitEvent;

/**
 * Game settings interface
 */
export interface GameSettings {
  debugLevel: number;
  graphicsQuality: 'auto' | 'high' | 'medium' | 'low';
  soundVolume: number;
  musicVolume: number;
  invertY: boolean;
  mouseSensitivity: number;
  showFPS: boolean;
  enableShadows: boolean;
}

/**
 * Camera type
 */
export type CameraType = 'first-person' | 'third-person';

/**
 * Remote player data
 */
export interface RemotePlayer {
  id: string;
  name: string;
  playerType: PlayerType;
  lastState: PlayerState;
  lastUpdate: number;
} 