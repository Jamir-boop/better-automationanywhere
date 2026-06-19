export interface ControlRoomVersionDetails {
	versionNumber?: string;
	versionRelease?: string;
	buildNumber?: string;
	buildDate?: string;
	edition?: string;
	[key: string]: unknown;
}

export interface SupportedControlRoomTarget {
	versionNumber: string;
	versionRelease: string;
	buildNumber: string;
	productVersion: string;
}

export type ControlRoomCompatibilityState = 'supported' | 'unsupported' | 'unknown';

export interface ControlRoomCompatibilityStatus {
	state: ControlRoomCompatibilityState;
	supported: boolean;
	buildMismatch: boolean;
	target: SupportedControlRoomTarget;
	current?: ControlRoomVersionDetails;
	message?: string;
}

export const SUPPORTED_CONTROL_ROOM_TARGETS: SupportedControlRoomTarget[] = [
	{
		versionNumber: '20.1.0.0',
		versionRelease: 'LTS',
		buildNumber: '45946', //latam
		productVersion: '40.0.0',
	},
	{
	  versionNumber: '20.1.0.0',
	  versionRelease: 'LTS',
	  buildNumber: '45983', //prot
	  productVersion: '40.0.0',
	},
];
export const SUPPORTED_CONTROL_ROOM_TARGET = SUPPORTED_CONTROL_ROOM_TARGETS[0];

function normalizeVersionPart(value: unknown): string {
	return String(value ?? '').trim();
}

export function formatControlRoomTarget(
	target: Pick<SupportedControlRoomTarget, 'versionNumber' | 'versionRelease'>
): string {
	return `${target.versionNumber} ${target.versionRelease}`.trim();
}

export function formatControlRoomVersion(details?: ControlRoomVersionDetails): string {
	if (!details) return 'unknown';
	const target = formatControlRoomTarget({
		versionNumber: normalizeVersionPart(details.versionNumber) || 'unknown',
		versionRelease: normalizeVersionPart(details.versionRelease),
	});
	const build = normalizeVersionPart(details.buildNumber);
	return build ? `${target} build ${build}` : target;
}

function matchesVersionTarget(
	current: ControlRoomVersionDetails,
	target: SupportedControlRoomTarget
): boolean {
	return (
		normalizeVersionPart(current.versionNumber) === target.versionNumber &&
		normalizeVersionPart(current.versionRelease) === target.versionRelease
	);
}

export function evaluateControlRoomCompatibility(
	current?: ControlRoomVersionDetails,
	message?: string
): ControlRoomCompatibilityStatus {
	if (!current) {
		return {
			state: 'unknown',
			supported: false,
			buildMismatch: false,
			target: SUPPORTED_CONTROL_ROOM_TARGET,
			message,
		};
	}

	const normalizedCurrentBuild = normalizeVersionPart(current.buildNumber);
	const exactTarget = SUPPORTED_CONTROL_ROOM_TARGETS.find(
		(target) => matchesVersionTarget(current, target) && normalizedCurrentBuild === target.buildNumber
	);
	const versionTarget = SUPPORTED_CONTROL_ROOM_TARGETS.find((target) => matchesVersionTarget(current, target));
	const supported = Boolean(versionTarget);
	const target = exactTarget ?? versionTarget ?? SUPPORTED_CONTROL_ROOM_TARGET;

	return {
		state: supported ? 'supported' : 'unsupported',
		supported,
		buildMismatch: Boolean(versionTarget && normalizedCurrentBuild && !exactTarget),
		target,
		current,
		message,
	};
}

export function createUnknownControlRoomCompatibility(
	message?: string
): ControlRoomCompatibilityStatus {
	return evaluateControlRoomCompatibility(undefined, message);
}
