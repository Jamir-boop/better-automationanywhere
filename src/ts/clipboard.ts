import { storage } from '#imports';
import * as utils from './utils';

// Clipboard slots and universal clipboard, using WXT storage API
export const universalClipboardSlot = (slot: number) =>
    storage.defineItem<string | null>(`local:universalClipboardSlot${slot}`);
export const universalClipboard = storage.defineItem<string | null>('local:universalClipboard');


export async function copyToSlot(slot: number): Promise<void> {
    utils.clickIfExists(".aa-icon-action-clipboard-copy--shared", "copyToSlot");
    const globalClipboardJSON = localStorage.getItem('globalClipboard');
    try {
        if (!globalClipboardJSON) throw new Error("No clipboard data in localStorage");
        const clipboardData = JSON.parse(globalClipboardJSON);
        clipboardData.uid = "🔥🔥🔥";
        await universalClipboardSlot(slot).setValue(JSON.stringify(clipboardData));
    } catch (error) {
        console.error("Failed to copy data to slot:", error);
    }
}

export async function pasteFromSlot(slot: number): Promise<void> {
    const clipboardData = await universalClipboardSlot(slot).getValue();
    if (!clipboardData) return;
    let emojiUid = generateEmojiString();
    let modifiedData = clipboardData.replace(/🔥🔥🔥/g, emojiUid);

    // Clean the JSON before pasting
    let cleanedData = cleanAutomationAnywhereJson(modifiedData);

    localStorage.setItem('globalClipboard', cleanedData);
    localStorage.setItem('globalClipboardUid', `"${emojiUid}"`);
    utils.clickIfExists(".aa-icon-action-clipboard-paste--shared", "pasteFromSlot");
    setTimeout(() => {
        utils.clickIfExists(".aa-icon-action-clipboard-paste--shared", "pasteFromSlot");
    }, 500);
}

export async function universalCopy(): Promise<void> {
    utils.clickIfExists(".aa-icon-action-clipboard-copy--shared", "universalCopy");
    const globalClipboardJSON = localStorage.getItem('globalClipboard');
    let globalClipboard: any = {};
    try {
        if (!globalClipboardJSON) throw new Error("No clipboard data in localStorage");
        globalClipboard = JSON.parse(globalClipboardJSON);
    } catch (e) {
        console.error("Error parsing JSON:", e);
        return;
    }
    globalClipboard.uid = "🔥🔥🔥";
    await universalClipboard.setValue(JSON.stringify(globalClipboard));
}

export async function universalPaste(): Promise<void> {
    utils.clickIfExists(".aa-icon-action-clipboard-copy--shared", "universalPaste");
    let universalClipboardData = await universalClipboard.getValue();
    if (universalClipboardData) {
        let emojiUid = generateEmojiString();
        universalClipboardData = universalClipboardData.replace(/'/g, '"');
        universalClipboardData = universalClipboardData.replace(/🔥🔥🔥/g, emojiUid);

        // Clean the JSON before pasting
        let cleanedData = cleanAutomationAnywhereJson(universalClipboardData);

        localStorage.setItem("globalClipboard", cleanedData);
        localStorage.setItem("globalClipboardUid", `"${emojiUid}"`);
    }
    setTimeout(() => {
        utils.clickIfExists(".aa-icon-action-clipboard-paste--shared", "universalPaste");
    }, 1000);
}

export function generateEmojiString(): string {
    const emojis = [
        "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
        "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "😣",
        "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓",
        "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪",
        "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻", "💀",
        "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾"
    ];
    let uniqueString = "";
    for (let i = 0; i < 10; i++) {
        uniqueString += emojis[Math.floor(Math.random() * emojis.length)];
    }
    return uniqueString;
}

export function clearUncopiableFields(obj: any): void {
    if (!obj || typeof obj !== "object") return;
    for (const key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        if (key === "blob" || key === "thumbnailMetadataPath" || key === "screenshotMetadataPath") {
            obj[key] = "";
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
            clearUncopiableFields(obj[key]);
        }
    }
}

export function cleanAutomationAnywhereJson(jsonString: string): string {
    let data: any;
    try {
        data = JSON.parse(jsonString);
    } catch (e) {
        console.error("Invalid JSON input", e);
        return jsonString;
    }

    if (!Array.isArray(data.nodes)) return JSON.stringify(data);

    for (const node of data.nodes) {
        if (!Array.isArray(node.attributes)) continue;
        for (const attr of node.attributes) {
            if (attr.value && typeof attr.value === "object") {
                clearUncopiableFields(attr.value);
            }
        }
    }
    return JSON.stringify(data);
}