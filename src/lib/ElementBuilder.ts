import {
    ElementInteractionParam,
    IElementBuilder,
} from "../../definition/ui-kit/Element/IElementBuilder";
import {
    ButtonElement,
    BlockElementType,
    TextObjectType,
    ImageElement,
    StaticSelectElement,
    Option,
} from "@rocket.chat/ui-kit";
import { ButtonParam } from "../../definition/ui-kit/Element/IButtonElement";
import { ImageParam } from "../../definition/ui-kit/Element/IImageElement";
import {
    StaticSelectElementParam,
    StaticSelectOptionsParam,
} from "../../definition/ui-kit/Element/IStaticSelectElement";

export class ElementBuilder implements IElementBuilder {
    constructor(private readonly appId: string) {}
    public addButton(
        param: ButtonParam,
        interaction: ElementInteractionParam
    ): ButtonElement {
        const { text, url, value, style } = param;
        const { blockId, actionId } = interaction;
        const button: ButtonElement = {
            type: BlockElementType.BUTTON,
            text: {
                type: TextObjectType.PLAIN_TEXT,
                text,
            },
            appId: this.appId,
            blockId,
            actionId,
            url,
            value,
            style,
        };
        return button;
    }

    public addImage(param: ImageParam): ImageElement {
        const { imageUrl, altText } = param;
        const image: ImageElement = {
            type: BlockElementType.IMAGE,
            imageUrl,
            altText,
        };
        return image;
    }

    public addDropDown(
        param: StaticSelectElementParam,
        interaction: ElementInteractionParam
    ): StaticSelectElement {
        const {
            placeholder,
            options,
            optionGroups,
            initialOption,
            initialValue,
        } = param;
        const { blockId, actionId } = interaction;
        const dropDown: StaticSelectElement = {
            type: BlockElementType.STATIC_SELECT,
            placeholder: {
                type: TextObjectType.PLAIN_TEXT,
                text: placeholder,
            },
            options,
            optionGroups,
            initialOption,
            initialValue,
            appId: this.appId,
            blockId,
            actionId,
        };
        return dropDown;
    }

    public createDropDownOptions(
        param: StaticSelectOptionsParam
    ): Array<Option> {
        const options: Array<Option> = param.map((option) => {
            const { text, value, description, url } = option;
            const optionObject: Option = {
                text: {
                    type: TextObjectType.PLAIN_TEXT,
                    text,
                },
                value,
                ...(description
                    ? {
                          description: {
                              type: TextObjectType.PLAIN_TEXT,
                              text: description,
                          },
                      }
                    : undefined),
                url,
            };
            return optionObject;
        });
        return options;
    }
}
