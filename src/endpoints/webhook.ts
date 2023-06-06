import {
    HttpStatusCode,
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
    ApiEndpoint,
    IApiEndpointInfo,
    IApiRequest,
    IApiResponse,
} from "@rocket.chat/apps-engine/definition/api";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { URL } from "url";
import {
    OAuth2Content,
    OAuth2Credential,
    OAuth2Locator,
} from "../../enum/OAuth2";
import { ClientError } from "../../errors/Error";
import { OAuth2Storage } from "../authorization/OAuth2Storage";
import { getCredentials } from "../helper/getCredential";
import { sendNotification } from "../helper/message";
import { BlockBuilder } from "../lib/BlockBuilder";
import { NotionSDK } from "../lib/NotionSDK";
import { RoomInteractionStorage } from "../storage/RoomInteraction";

export class WebHookEndpoint extends ApiEndpoint {
    public path: string = "webhook";
    public url_path: string = OAuth2Locator.redirectUrlPath;
    public accessTokenUrl: string = OAuth2Locator.accessTokenUrl;
    public async get(
        request: IApiRequest,
        endpoint: IApiEndpointInfo,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence
    ): Promise<IApiResponse> {
        const { code, state, error } = request.query;

        // incase when user leaves in between the auth process
        if (error) {
            this.app.getLogger().warn(error);
            return {
                status: HttpStatusCode.UNAUTHORIZED,
                content: OAuth2Content.failed,
            };
        }

        const user = await read.getUserReader().getById(state);
        // incase when user changed the state in authUrl
        if (!user) {
            this.app
                .getLogger()
                .warn(`User not found before access token request`);
            return {
                status: HttpStatusCode.NON_AUTHORITATIVE_INFORMATION,
                content: OAuth2Content.failed,
            };
        }

        const { clientId, clientSecret, siteUrl } = await getCredentials(read);
        const redirectUrl = new URL(this.url_path, siteUrl);
        const credentials = new Buffer(`${clientId}:${clientSecret}`).toString(
            OAuth2Credential.FORMAT
        );

        const notionSDK = new NotionSDK();
        const response = await notionSDK.createToken(
            http,
            redirectUrl,
            code,
            credentials
        );

        // incase there is some error in creation of Token from Notion
        if (response instanceof ClientError) {
            this.app.getLogger().warn(response.message);
            return {
                status: response.statusCode,
                content: OAuth2Content.failed,
            };
        }

        const persistenceRead = read.getPersistenceReader();
        const oAuth2Storage = new OAuth2Storage(persis, persistenceRead);
        await oAuth2Storage.connectUserToWorkspace(response, state);

        const roomInteraction = new RoomInteractionStorage(
            persis,
            persistenceRead
        );
        const roomId = await roomInteraction.getInteractionRoomId(user.id);
        const room = (await read.getRoomReader().getById(roomId)) as IRoom;

        const workspaceName = response.workspace_name as string;

        const blockBuilder = new BlockBuilder(this.app.getID());
        const sectionBlock = blockBuilder.createSectionBlock({
            text: `👋You are connected to Workspace **${workspaceName}**`,
        });

        await sendNotification(read, modify, user, room, {
            blocks: [sectionBlock],
        });
        await roomInteraction.clearInteractionRoomId(user.id);

        return this.success(OAuth2Content.success);
    }
}