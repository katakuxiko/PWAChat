/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface DtoAdminCreateRequest {
	is_super_user?: boolean;
	/** @example "secret123" */
	password?: string;
	/** @example "admin" */
	username?: string;
}

export interface DtoAdminResponse {
	id?: string;
	is_super_user?: boolean;
	username?: string;
}

export interface DtoChatCreateRequest {
	/** @example "Обсуждение проекта" */
	descr?: string;
	/** @example "Project Chat" */
	name?: string;
}

export interface DtoChatResponse {
	admin_id?: string;
	created_date?: string;
	descr?: string;
	id?: string;
	name?: string;
}

export interface DtoChatSettingCreateRequest {
	chatID: string;
	descr?: string;
	helloText?: string;
	name?: string;
	settings?: ModelsJSONB;
	url?: string;
}

export interface DtoChatSettingResponse {
	chatID?: string;
	createdDate?: string;
	descr?: string;
	helloText?: string;
	id?: string;
	name?: string;
	settings?: ModelsJSONB;
	url?: string;
}

export interface DtoChatSettingUpdateRequest {
	descr?: string;
	helloText?: string;
	name?: string;
	settings?: ModelsJSONB;
	url?: string;
}

export interface DtoChatUserCreateRequest {
	/** @example "secret123" */
	password?: string;
	/** @example "info" */
	user_info?: string;
	/** @example "member" */
	user_role?: string;
	/** @example "chatuser" */
	username?: string;
}

export interface DtoChatUserResponse {
	id?: string;
	/** @example "info" */
	user_info?: string;
	/** @example "member" */
	user_role?: string;
	username?: string;
}

export interface DtoDocumentIngestResponse {
	chunks_saved?: number;
	chunks_total?: number;
	/** можно заменить на конкретный DTO DocumentResponseDTO */
	doc?: any;
	status?: string;
}

export interface DtoDocumentResponseDTO {
	access_level?: number;
	chat_id?: string;
	created_date?: string;
	id?: string;
	name?: string;
	path?: string;
	protected?: boolean;
	tags?: string[];
}

export interface DtoDocumentTagsResponse {
	tags?: string[];
}

export interface DtoLoginRequest {
	password?: string;
	username?: string;
}

export interface DtoPaginatedDocuments {
	current_page?: number;
	documents?: ModelsDocument[];
	total?: number;
	total_pages?: number;
}

export interface ModelsAskRequest {
	chat_id?: string;
	model?: string;
	query?: string;
	settings?: ModelsAskSettings;
	topK?: number;
}

export interface ModelsAskSettings {
	enableHistory?: boolean;
	maxTokens?: number;
	model?: string;
	requestsLimit?: number;
	requestsWindow?: number;
	systemPrompt?: string;
	temperature?: number;
}

export interface ModelsDocument {
	access_level?: number;
	chat_id?: string;
	created_date?: string;
	full_path?: string;
	id?: string;
	name?: string;
	path?: string;
	protected?: boolean;
	tags?: string[];
}

export type ModelsJSONB = Record<string, any>;

export interface ModelsRule {
	description?: string;
	id?: number;
	name?: string;
}

import type {
	AxiosInstance,
	AxiosRequestConfig,
	AxiosResponse,
	HeadersDefaults,
	ResponseType,
} from "axios";
import axios from "axios";

export type QueryParamsType = Record<string | number, any>;

export interface FullRequestParams
	extends Omit<AxiosRequestConfig, "data" | "params" | "url" | "responseType"> {
	/** set parameter to `true` for call `securityWorker` for this request */
	secure?: boolean;
	/** request path */
	path: string;
	/** content type of request body */
	type?: ContentType;
	/** query params */
	query?: QueryParamsType;
	/** format of response (i.e. response.json() -> format: "json") */
	format?: ResponseType;
	/** request body */
	body?: unknown;
}

export type RequestParams = Omit<
	FullRequestParams,
	"body" | "method" | "query" | "path"
>;

export interface ApiConfig<SecurityDataType = unknown>
	extends Omit<AxiosRequestConfig, "data" | "cancelToken"> {
	securityWorker?: (
		securityData: SecurityDataType | null,
	) => Promise<AxiosRequestConfig | void> | AxiosRequestConfig | void;
	secure?: boolean;
	format?: ResponseType;
}

export enum ContentType {
	Json = "application/json",
	JsonApi = "application/vnd.api+json",
	FormData = "multipart/form-data",
	UrlEncoded = "application/x-www-form-urlencoded",
	Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
	public instance: AxiosInstance;
	private securityData: SecurityDataType | null = null;
	private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
	private secure?: boolean;
	private format?: ResponseType;

	constructor({
		securityWorker,
		secure,
		format,
		...axiosConfig
	}: ApiConfig<SecurityDataType> = {}) {
		this.instance = axios.create({
			...axiosConfig,
			baseURL: axiosConfig.baseURL || "",
		});
		this.secure = secure;
		this.format = format;
		this.securityWorker = securityWorker;
	}

	public setSecurityData = (data: SecurityDataType | null) => {
		this.securityData = data;
	};

	protected mergeRequestParams(
		params1: AxiosRequestConfig,
		params2?: AxiosRequestConfig,
	): AxiosRequestConfig {
		const method = params1.method || (params2 && params2.method);

		return {
			...this.instance.defaults,
			...params1,
			...(params2 || {}),
			headers: {
				...((method &&
					this.instance.defaults.headers[
						method.toLowerCase() as keyof HeadersDefaults
					]) ||
					{}),
				...(params1.headers || {}),
				...((params2 && params2.headers) || {}),
			},
		};
	}

	protected stringifyFormItem(formItem: unknown) {
		if (typeof formItem === "object" && formItem !== null) {
			return JSON.stringify(formItem);
		} else {
			return `${formItem}`;
		}
	}

	protected createFormData(input: Record<string, unknown>): FormData {
		if (input instanceof FormData) {
			return input;
		}
		return Object.keys(input || {}).reduce((formData, key) => {
			const property = input[key];
			const propertyContent: any[] =
				property instanceof Array ? property : [property];

			for (const formItem of propertyContent) {
				const isFileType = formItem instanceof Blob || formItem instanceof File;
				formData.append(
					key,
					isFileType ? formItem : this.stringifyFormItem(formItem),
				);
			}

			return formData;
		}, new FormData());
	}

	public request = async <T = any, _E = any>({
		secure,
		path,
		type,
		query,
		format,
		body,
		...params
	}: FullRequestParams): Promise<AxiosResponse<T>> => {
		const secureParams =
			((typeof secure === "boolean" ? secure : this.secure) &&
				this.securityWorker &&
				(await this.securityWorker(this.securityData))) ||
			{};
		const requestParams = this.mergeRequestParams(params, secureParams);
		const responseFormat = format || this.format || undefined;

		if (
			type === ContentType.FormData &&
			body &&
			body !== null &&
			typeof body === "object"
		) {
			body = this.createFormData(body as Record<string, unknown>);
		}

		if (
			type === ContentType.Text &&
			body &&
			body !== null &&
			typeof body !== "string"
		) {
			body = JSON.stringify(body);
		}

		return this.instance.request({
			...requestParams,
			headers: {
				...(requestParams.headers || {}),
				...(type ? { "Content-Type": type } : {}),
			},
			params: query,
			responseType: responseFormat,
			data: body,
			url: path,
		});
	};
}

/**
 * @title Diplom API
 * @version 1.0
 * @contact
 *
 * API для дипломного проекта asd
 */
export class Api<
	SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
	admins = {
		/**
		 * @description Возвращает список админов
		 *
		 * @tags admins
		 * @name AdminsList
		 * @summary Получить всех админов
		 * @request GET:/admins
		 * @secure
		 */
		adminsList: (params: RequestParams = {}) =>
			this.request<DtoAdminResponse[][], Record<string, string>>({
				path: `/admins`,
				method: "GET",
				secure: true,
				format: "json",
				...params,
			}),

		/**
		 * @description Создаёт нового админа
		 *
		 * @tags admins
		 * @name AdminsCreate
		 * @summary Создать админа
		 * @request POST:/admins
		 */
		adminsCreate: (admin: DtoAdminCreateRequest, params: RequestParams = {}) =>
			this.request<DtoAdminResponse, Record<string, string>>({
				path: `/admins`,
				method: "POST",
				body: admin,
				type: ContentType.Json,
				format: "json",
				...params,
			}),

		/**
		 * @description Возвращает админа по UUID
		 *
		 * @tags admins
		 * @name AdminsDetail
		 * @summary Получить админа по ID
		 * @request GET:/admins/{id}
		 */
		adminsDetail: (id: string, params: RequestParams = {}) =>
			this.request<DtoAdminResponse, Record<string, string>>({
				path: `/admins/${id}`,
				method: "GET",
				format: "json",
				...params,
			}),

		/**
		 * @description Обновляет данные админа по UUID
		 *
		 * @tags admins
		 * @name AdminsUpdate
		 * @summary Обновить админа
		 * @request PUT:/admins/{id}
		 */
		adminsUpdate: (
			id: string,
			admin: DtoAdminCreateRequest,
			params: RequestParams = {},
		) =>
			this.request<DtoAdminResponse, Record<string, string>>({
				path: `/admins/${id}`,
				method: "PUT",
				body: admin,
				type: ContentType.Json,
				format: "json",
				...params,
			}),

		/**
		 * @description Удаляет админа по UUID
		 *
		 * @tags admins
		 * @name AdminsDelete
		 * @summary Удалить админа
		 * @request DELETE:/admins/{id}
		 */
		adminsDelete: (id: string, params: RequestParams = {}) =>
			this.request<void, Record<string, string>>({
				path: `/admins/${id}`,
				method: "DELETE",
				...params,
			}),
	};
	ask = {
		/**
		 * @description Получение ответа на вопрос с использованием Retrieval-Augmented Generation (RAG)
		 *
		 * @tags RAG
		 * @name PostAsk
		 * @summary Ask a question to the RAG system (LLM + search)
		 * @request POST:/ask
		 */
		postAsk: (request: ModelsAskRequest, params: RequestParams = {}) =>
			this.request<ModelsJSONB, Record<string, string>>({
				path: `/ask`,
				method: "POST",
				body: request,
				type: ContentType.Json,
				format: "json",
				...params,
			}),
	};
	auth = {
		/**
		 * @description Проверяет логин/пароль и возвращает JWT токен
		 *
		 * @tags auth
		 * @name LoginCreate
		 * @summary Авторизация администратора
		 * @request POST:/auth/login
		 */
		loginCreate: (request: DtoLoginRequest, params: RequestParams = {}) =>
			this.request<Record<string, string>, Record<string, string>>({
				path: `/auth/login`,
				method: "POST",
				body: request,
				type: ContentType.Json,
				format: "json",
				...params,
			}),
	};
	chatSettings = {
		/**
		 * @description Возвращает список всех настроек чатов
		 *
		 * @tags chat-settings
		 * @name ChatSettingsList
		 * @summary Получить все настройки чатов
		 * @request GET:/chat-settings
		 * @secure
		 */
		chatSettingsList: (params: RequestParams = {}) =>
			this.request<DtoChatSettingResponse[], Record<string, string>>({
				path: `/chat-settings`,
				method: "GET",
				secure: true,
				format: "json",
				...params,
			}),

		/**
		 * @description Создает новые настройки чата или обновляет существующие по chat_id
		 *
		 * @tags chat-settings
		 * @name ChatSettingsCreate
		 * @summary Создать или обновить настройки чата
		 * @request POST:/chat-settings
		 * @secure
		 */
		chatSettingsCreate: (
			settings: DtoChatSettingCreateRequest,
			params: RequestParams = {},
		) =>
			this.request<DtoChatSettingResponse, Record<string, string>>({
				path: `/chat-settings`,
				method: "POST",
				body: settings,
				secure: true,
				type: ContentType.Json,
				format: "json",
				...params,
			}),

		/**
		 * @description Возвращает настройки для указанного чата
		 *
		 * @tags chat-settings
		 * @name ChatDetail
		 * @summary Получить настройки по ID чата
		 * @request GET:/chat-settings/chat/{chatId}
		 * @secure
		 */
		chatDetail: (chatId: string, params: RequestParams = {}) =>
			this.request<DtoChatSettingResponse, Record<string, string>>({
				path: `/chat-settings/chat/${chatId}`,
				method: "GET",
				secure: true,
				format: "json",
				...params,
			}),

		/**
		 * @description Возвращает настройки чата по ID записи настроек
		 *
		 * @tags chat-settings
		 * @name ChatSettingsDetail
		 * @summary Получить настройки чата по ID настройки
		 * @request GET:/chat-settings/{id}
		 * @secure
		 */
		chatSettingsDetail: (id: string, params: RequestParams = {}) =>
			this.request<DtoChatSettingResponse, Record<string, string>>({
				path: `/chat-settings/${id}`,
				method: "GET",
				secure: true,
				format: "json",
				...params,
			}),

		/**
		 * @description Обновляет настройки чата по ID
		 *
		 * @tags chat-settings
		 * @name ChatSettingsUpdate
		 * @summary Обновить настройки чата
		 * @request PUT:/chat-settings/{id}
		 * @secure
		 */
		chatSettingsUpdate: (
			id: string,
			settings: DtoChatSettingUpdateRequest,
			params: RequestParams = {},
		) =>
			this.request<DtoChatSettingResponse, Record<string, string>>({
				path: `/chat-settings/${id}`,
				method: "PUT",
				body: settings,
				secure: true,
				type: ContentType.Json,
				format: "json",
				...params,
			}),

		/**
		 * @description Удаляет настройки чата по ID
		 *
		 * @tags chat-settings
		 * @name ChatSettingsDelete
		 * @summary Удалить настройки чата
		 * @request DELETE:/chat-settings/{id}
		 * @secure
		 */
		chatSettingsDelete: (id: string, params: RequestParams = {}) =>
			this.request<void, Record<string, string>>({
				path: `/chat-settings/${id}`,
				method: "DELETE",
				secure: true,
				...params,
			}),
	};
	chats = {
		/**
		 * No description
		 *
		 * @tags chats
		 * @name ChatsList
		 * @summary Получить список чатов
		 * @request GET:/chats
		 * @secure
		 */
		chatsList: (params: RequestParams = {}) =>
			this.request<DtoChatResponse[], any>({
				path: `/chats`,
				method: "GET",
				secure: true,
				format: "json",
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags chats
		 * @name ChatsCreate
		 * @summary Создать чат
		 * @request POST:/chats
		 * @secure
		 */
		chatsCreate: (chat: DtoChatCreateRequest, params: RequestParams = {}) =>
			this.request<DtoChatResponse, any>({
				path: `/chats`,
				method: "POST",
				body: chat,
				secure: true,
				type: ContentType.Json,
				format: "json",
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags chats
		 * @name ChatsDetail
		 * @summary Получить чат по ID
		 * @request GET:/chats/{id}
		 * @secure
		 */
		chatsDetail: (id: string, params: RequestParams = {}) =>
			this.request<DtoChatResponse, any>({
				path: `/chats/${id}`,
				method: "GET",
				secure: true,
				format: "json",
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags chats
		 * @name ChatsUpdate
		 * @summary Обновить чат
		 * @request PUT:/chats/{id}
		 * @secure
		 */
		chatsUpdate: (
			id: string,
			chat: DtoChatCreateRequest,
			params: RequestParams = {},
		) =>
			this.request<DtoChatResponse, any>({
				path: `/chats/${id}`,
				method: "PUT",
				body: chat,
				secure: true,
				type: ContentType.Json,
				format: "json",
				...params,
			}),

		/**
		 * No description
		 *
		 * @tags chats
		 * @name ChatsDelete
		 * @summary Удалить чат
		 * @request DELETE:/chats/{id}
		 * @secure
		 */
		chatsDelete: (id: string, params: RequestParams = {}) =>
			this.request<void, any>({
				path: `/chats/${id}`,
				method: "DELETE",
				secure: true,
				...params,
			}),
	};
	chatusers = {
		/**
		 * @description Возвращает список пользователей чата
		 *
		 * @tags chatusers
		 * @name ChatusersList
		 * @summary Получить всех пользователей чата
		 * @request GET:/chatusers
		 * @secure
		 */
		chatusersList: (params: RequestParams = {}) =>
			this.request<DtoChatUserResponse[][], Record<string, string>>({
				path: `/chatusers`,
				method: "GET",
				secure: true,
				format: "json",
				...params,
			}),

		/**
		 * @description Создаёт нового пользователя чата
		 *
		 * @tags chatusers
		 * @name ChatusersCreate
		 * @summary Создать пользователя чата
		 * @request POST:/chatusers
		 */
		chatusersCreate: (
			chatuser: DtoChatUserCreateRequest,
			params: RequestParams = {},
		) =>
			this.request<DtoChatUserResponse, Record<string, string>>({
				path: `/chatusers`,
				method: "POST",
				body: chatuser,
				type: ContentType.Json,
				format: "json",
				...params,
			}),

		/**
		 * @description Загружает Excel-файл (.xlsx) и добавляет пользователей в базу
		 *
		 * @tags chatusers
		 * @name ImportCreate
		 * @summary Импорт пользователей из Excel
		 * @request POST:/chatusers/import
		 * @secure
		 */
		importCreate: (
			data: {
				/**
				 * Excel файл (.xlsx)
				 * @format binary
				 */
				file: File;
			},
			params: RequestParams = {},
		) =>
			this.request<Record<string, string>, Record<string, string>>({
				path: `/chatusers/import`,
				method: "POST",
				body: data,
				secure: true,
				type: ContentType.FormData,
				format: "json",
				...params,
			}),

		/**
		 * @description Возвращает пользователя чата по UUID
		 *
		 * @tags chatusers
		 * @name ChatusersDetail
		 * @summary Получить пользователя чата по ID
		 * @request GET:/chatusers/{id}
		 */
		chatusersDetail: (id: string, params: RequestParams = {}) =>
			this.request<DtoChatUserResponse, Record<string, string>>({
				path: `/chatusers/${id}`,
				method: "GET",
				format: "json",
				...params,
			}),

		/**
		 * @description Обновляет данные пользователя чата по UUID
		 *
		 * @tags chatusers
		 * @name ChatusersUpdate
		 * @summary Обновить пользователя чата
		 * @request PUT:/chatusers/{id}
		 */
		chatusersUpdate: (
			id: string,
			chatuser: DtoChatUserCreateRequest,
			params: RequestParams = {},
		) =>
			this.request<DtoChatUserResponse, Record<string, string>>({
				path: `/chatusers/${id}`,
				method: "PUT",
				body: chatuser,
				type: ContentType.Json,
				format: "json",
				...params,
			}),

		/**
		 * @description пользователя чата по UUID
		 *
		 * @tags chatusers
		 * @name ChatusersDelete
		 * @summary пользователя чата
		 * @request DELETE:/chatusers/{id}
		 */
		chatusersDelete: (id: string, params: RequestParams = {}) =>
			this.request<void, Record<string, string>>({
				path: `/chatusers/${id}`,
				method: "DELETE",
				...params,
			}),
	};
	documents = {
		/**
		 * @description Возвращает список документов для конкретного чата с пагинацией
		 *
		 * @tags documents
		 * @name DocumentsList
		 * @summary Получить документы чата с пагинацией
		 * @request GET:/documents
		 * @secure
		 */
		documentsList: (
			query: {
				/** Chat ID (UUID) */
				chat_id: string;
				/**
				 * Номер страницы
				 * @default 1
				 */
				page?: number;
				/**
				 * Количество документов на странице
				 * @default 10
				 */
				limit?: number;
				/** Фильтр по тэгам, JSON array или comma-separated */
				tags?: string;
			},
			params: RequestParams = {},
		) =>
			this.request<DtoPaginatedDocuments, Record<string, string>>({
				path: `/documents`,
				method: "GET",
				query: query,
				secure: true,
				format: "json",
				...params,
			}),

		/**
		 * @description Загружает файл в MinIO и сохраняет метаданные в БД
		 *
		 * @tags documents
		 * @name DocumentsCreate
		 * @summary Загрузить документ
		 * @request POST:/documents
		 * @secure
		 */
		documentsCreate: (
			data: {
				/** Chat ID (UUID) */
				chat_id: string;
				/**
				 * Document file
				 * @format binary
				 */
				file: File;
				/** Document tags, JSON array or comma-separated list */
				tags?: string;
			},
			params: RequestParams = {},
		) =>
			this.request<DtoDocumentResponseDTO, Record<string, string>>({
				path: `/documents`,
				method: "POST",
				body: data,
				secure: true,
				type: ContentType.FormData,
				format: "json",
				...params,
			}),

		/**
		 * @description Загружает документ, сохраняет его в MinIO, извлекает текст, дробит на части и сохраняет embeddings в базе данных.
		 *
		 * @tags documents
		 * @name UploadCreate
		 * @summary Upload and ingest documents
		 * @request POST:/documents/upload
		 * @secure
		 */
		uploadCreate: (
			data: {
				/** Chat ID (uuid) */
				chat_id: string;
				/**
				 * document file
				 * @format binary
				 */
				file: File;
				/** Document tags, JSON array or comma-separated list */
				tags?: string;
			},
			params: RequestParams = {},
		) =>
			this.request<DtoDocumentIngestResponse, Record<string, string>>({
				path: `/documents/upload`,
				method: "POST",
				body: data,
				secure: true,
				type: ContentType.FormData,
				format: "json",
				...params,
			}),

		/**
		 * @description Возвращает уникальный список тэгов документов для конкретного чата
		 *
		 * @tags documents
		 * @name DocumentsTagsList
		 * @summary Получить доступные тэги документов чата
		 * @request GET:/documents/tags
		 * @secure
		 */
		documentsTagsList: (
			query: {
				/** Chat ID (UUID) */
				chat_id: string;
			},
			params: RequestParams = {},
		) =>
			this.request<DtoDocumentTagsResponse, Record<string, string>>({
				path: `/documents/tags`,
				method: "GET",
				query: query,
				secure: true,
				format: "json",
				...params,
			}),

		/**
		 * @description Возвращает один документ по UUID
		 *
		 * @tags documents
		 * @name DocumentsDetail
		 * @summary Получить документ по ID
		 * @request GET:/documents/{id}
		 * @secure
		 */
		documentsDetail: (id: string, params: RequestParams = {}) =>
			this.request<DtoDocumentResponseDTO, Record<string, string>>({
				path: `/documents/${id}`,
				method: "GET",
				secure: true,
				format: "json",
				...params,
			}),

		/**
		 * @description Удаляет документ по UUID
		 *
		 * @tags documents
		 * @name DocumentsDelete
		 * @summary Удалить документ
		 * @request DELETE:/documents/{id}
		 * @secure
		 */
		documentsDelete: (id: string, params: RequestParams = {}) =>
			this.request<void, Record<string, string>>({
				path: `/documents/${id}`,
				method: "DELETE",
				secure: true,
				...params,
			}),

		/**
		 * @description Полностью заменяет тэги документа
		 *
		 * @tags documents
		 * @name DocumentsUpdateTags
		 * @summary Обновить тэги документа
		 * @request PUT:/documents/{id}/tags
		 * @secure
		 */
		documentsUpdateTags: (
			id: string,
			data: { tags: string[] },
			params: RequestParams = {},
		) =>
			this.request<DtoDocumentResponseDTO, Record<string, string>>({
				path: `/documents/${id}/tags`,
				method: "PUT",
				body: data,
				secure: true,
				type: ContentType.Json,
				format: "json",
				...params,
			}),

		/**
		 * @description Возвращает файл документа для скачивания
		 *
		 * @tags documents
		 * @name DownloadList
		 * @summary Скачать файл документа
		 * @request GET:/documents/{id}/download
		 * @secure
		 */
		downloadList: (id: string, params: RequestParams = {}) =>
			this.request<File, Record<string, string>>({
				path: `/documents/${id}/download`,
				method: "GET",
				secure: true,
				...params,
			}),
	};
}
