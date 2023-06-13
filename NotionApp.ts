import {
    IAppAccessors,
    IConfigurationExtend,
    IEnvironmentRead,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { App } from "@rocket.chat/apps-engine/definition/App";
import { IAppInfo } from "@rocket.chat/apps-engine/definition/metadata";
import { settings } from "./config/settings";
import { OAuth2Client } from "./src/authorization/OAuth2Client";
import { NotionCommand } from "./src/commands/NotionCommand";
import { NotionSDK } from "./src/lib/NotionSDK";
import {
    ApiSecurity,
    ApiVisibility,
} from "@rocket.chat/apps-engine/definition/api";
import { WebHookEndpoint } from "./src/endpoints/webhook";
import { ElementBuilder } from "./src/lib/ElementBuilder";
import { BlockBuilder } from "./src/lib/BlockBuilder";
import {
    IUIKitResponse,
    UIKitBlockInteractionContext,
    UIKitViewCloseInteractionContext,
    UIKitViewSubmitInteractionContext,
} from "@rocket.chat/apps-engine/definition/uikit";
import { RoomInteractionStorage } from "./src/storage/RoomInteraction";
import { OAuth2Action } from "./enum/OAuth2";
import { IAppUtils } from "./definition/lib/IAppUtils";
import { ExecuteViewClosedHandler } from "./src/handlers/ExecuteViewClosedHandler";
import { ExecuteViewSubmitHandler } from "./src/handlers/ExecuteViewSubmitHandler";

export class NotionApp extends App {
    private oAuth2Client: OAuth2Client;
    private NotionSdk: NotionSDK;
    private elementBuilder: ElementBuilder;
    private blockBuilder: BlockBuilder;
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async initialize(
        configurationExtend: IConfigurationExtend,
        environmentRead: IEnvironmentRead
    ): Promise<void> {
        await configurationExtend.slashCommands.provideSlashCommand(
            new NotionCommand(this)
        );
        await Promise.all(
            settings.map((setting) => {
                configurationExtend.settings.provideSetting(setting);
            })
        );

        await configurationExtend.api.provideApi({
            visibility: ApiVisibility.PUBLIC,
            security: ApiSecurity.UNSECURE,
            endpoints: [new WebHookEndpoint(this)],
        });

        this.oAuth2Client = new OAuth2Client(this);
        this.NotionSdk = new NotionSDK(this.getAccessors().http);
        this.elementBuilder = new ElementBuilder(this.getID());
        this.blockBuilder = new BlockBuilder(this.getID());
    }

    public getOAuth2Client(): OAuth2Client {
        return this.oAuth2Client;
    }
    public getUtils(): IAppUtils {
        return {
            NotionSdk: this.NotionSdk,
            elementBuilder: this.elementBuilder,
            blockBuilder: this.blockBuilder,
        };
    }

    public async executeBlockActionHandler(
        context: UIKitBlockInteractionContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        // Todo[Week 2]: Make a Interface and Class
        const { actionId, user, room } = context.getInteractionData();

        if (actionId == OAuth2Action.CONNECT_TO_WORKSPACE) {
            const persistenceRead = read.getPersistenceReader();
            const roomId = room?.id as string;
            const roomInteraction = new RoomInteractionStorage(
                persistence,
                persistenceRead
            );
            await roomInteraction.storeInteractionRoomId(user.id, roomId);
        }

        return context.getInteractionResponder().successResponse();
    }

    public async executeViewSubmitHandler(
        context: UIKitViewSubmitInteractionContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        const handler = new ExecuteViewSubmitHandler(
            this,
            read,
            http,
            persistence,
            modify,
            context
        );

        return handler.handleActions();
    }

    public async executeViewClosedHandler(
        context: UIKitViewCloseInteractionContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        const handler = new ExecuteViewClosedHandler(
            this,
            read,
            http,
            persistence,
            modify,
            context
        );

        return handler.handleActions();
    }
}
