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

export const SUPPORTED_CONTROL_ROOM_TARGET: SupportedControlRoomTarget = {
	versionNumber: '20.1.0.0',
	versionRelease: 'LTS',
	buildNumber: '45946',
	productVersion: '40.0.0',
};

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

	const currentVersion = normalizeVersionPart(current.versionNumber);
	const currentRelease = normalizeVersionPart(current.versionRelease);
	const currentBuild = normalizeVersionPart(current.buildNumber);
	const supported =
		currentVersion === SUPPORTED_CONTROL_ROOM_TARGET.versionNumber &&
		currentRelease === SUPPORTED_CONTROL_ROOM_TARGET.versionRelease;

	return {
		state: supported ? 'supported' : 'unsupported',
		supported,
		buildMismatch:
			supported &&
			Boolean(currentBuild) &&
			currentBuild !== SUPPORTED_CONTROL_ROOM_TARGET.buildNumber,
		target: SUPPORTED_CONTROL_ROOM_TARGET,
		current,
		message,
	};
}

export function createUnknownControlRoomCompatibility(
	message?: string
): ControlRoomCompatibilityStatus {
	return evaluateControlRoomCompatibility(undefined, message);
}
