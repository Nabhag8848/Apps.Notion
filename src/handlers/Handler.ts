import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { IHanderParams, IHandler } from "../../definition/handlers/IHandler";
import { OAuth2Storage } from "../authorization/OAuth2Storage";
import { RoomInteractionStorage } from "../storage/RoomInteraction";
import { NotionApp } from "../../NotionApp";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { createDatabaseModal } from "../modals/createDatabaseModal";
import { Error } from "../../errors/Error";
import { ModalInteractionStorage } from "../storage/ModalInteraction";
import { DatabaseModal } from "../../enum/modals/NotionDatabase";

export class Handler implements IHandler {
    public app: NotionApp;
    public sender: IUser;
    public room: IRoom;
    public read: IRead;
    public modify: IModify;
    public http: IHttp;
    public persis: IPersistence;
    public oAuth2Storage: OAuth2Storage;
    public roomInteractionStorage: RoomInteractionStorage;
    public triggerId?: string;
    public threadId?: string;

    constructor(params: IHanderParams) {
        this.app = params.app;
        this.sender = params.sender;
        this.room = params.room;
        this.read = params.read;
        this.modify = params.modify;
        this.http = params.http;
        this.persis = params.persis;
        this.triggerId = params.triggerId;
        this.threadId = params.threadId;
        const persistenceRead = params.read.getPersistenceReader();
        this.oAuth2Storage = new OAuth2Storage(params.persis, persistenceRead);
        this.roomInteractionStorage = new RoomInteractionStorage(
            params.persis,
            persistenceRead,
            params.sender.id
        );
    }

    public async createNotionDatabase(): Promise<void> {
        const userId = this.sender.id;
        const roomId = this.room.id;
        const accessTokenInfo = await this.oAuth2Storage.getCurrentWorkspace(
            userId
        );

        if (!accessTokenInfo) {
            // send Notification to user to authorize
            return;
        }

        await this.roomInteractionStorage.storeInteractionRoomId(
            roomId
        );

        const persistenceRead = this.read.getPersistenceReader();
        const modalInteraction = new ModalInteractionStorage(
            this.persis,
            persistenceRead,
            userId,
            DatabaseModal.VIEW_ID
        );

        const modal = await createDatabaseModal(
            this.app,
            this.sender,
            this.read,
            this.persis,
            modalInteraction,
            accessTokenInfo
        );
        if (modal instanceof Error) {
            // Something went Wrong Question: Should we send a notification to the user?
            return;
        }

        if (this.triggerId) {
            await this.modify
                .getUiController()
                .openSurfaceView(
                    modal,
                    { triggerId: this.triggerId },
                    this.sender
                );
        }
    }
}
