import { Bubble, Sender, XProvider, type BubbleProps } from "@ant-design/x";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import PWABadge from "./PWABadge.tsx";
import { useTheme } from "./hooks/useTheme.ts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { useMutation, useQuery } from "@tanstack/react-query";
import api, { setAuthHeader } from "./axios/index.tsx";
import PdfViewer from "./components/PdfViewer.tsx";
import {
	Alert,
	Button,
	Drawer,
	Form,
	Input,
	Select,
	Spin,
	Typography,
	message,
	Modal,
} from "antd";

interface AskContextItem {
	DocID?: string;
	DocName?: string;
	Filepath?: string;
}

interface AskResponse {
	answer?: string;
	context?: AskContextItem[];
}

interface AskStreamRequest {
	query: string;
	chatID: string;
	chatHistoryID: string | null;
	model?: string;
	settings?: Record<string, unknown>;
	token: string | null;
	onDelta: (delta: string) => void;
}

interface AskDonePayload {
	answer?: unknown;
	context?: unknown;
	error?: unknown;
}

const parseSSEEventBlock = (block: string): { event: string; data: string } => {
	let event = "message";
	const dataLines: string[] = [];

	for (const line of block.split("\n")) {
		if (!line) {
			continue;
		}
		if (line.startsWith("event:")) {
			event = line.slice(6).trim();
			continue;
		}
		if (line.startsWith("data:")) {
			dataLines.push(line.slice(5).trimStart());
		}
	}

	return { event, data: dataLines.join("\n") };
};

const parseContextItems = (value: unknown): AskContextItem[] => {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter(
		(item) => typeof item === "object" && item !== null,
	) as AskContextItem[];
};

const streamAskQuestion = async ({
	query,
	chatID,
	chatHistoryID,
	model,
	settings,
	token,
	onDelta,
}: AskStreamRequest): Promise<AskResponse> => {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Accept: "text/event-stream",
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const askURL = api.instance.getUri({ url: "/ask" });
	const response = await fetch(askURL, {
		method: "POST",
		headers,
		body: JSON.stringify({
			query,
			chat_id: chatID,
			chat_history_id: chatHistoryID ?? undefined,
			model,
			settings,
			stream: true,
		}),
	});

	if (!response.ok) {
		let errorMessage = `Ошибка запроса: ${response.status}`;
		try {
			const errorData = (await response.json()) as { error?: unknown };
			if (
				typeof errorData.error === "string" &&
				errorData.error.trim() !== ""
			) {
				errorMessage = errorData.error;
			}
		} catch {
			// ignore parse error and return status message
		}
		throw new Error(errorMessage);
	}

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("text/event-stream")) {
		const fallback = (await response.json()) as AskResponse & {
			error?: unknown;
		};
		if (typeof fallback.error === "string" && fallback.error.trim() !== "") {
			throw new Error(fallback.error);
		}
		return {
			answer: typeof fallback.answer === "string" ? fallback.answer : "",
			context: parseContextItems(fallback.context),
		};
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("Пустой поток ответа");
	}

	const decoder = new TextDecoder();
	let buffer = "";
	let accumulatedAnswer = "";
	let doneAnswer = "";
	let doneContext: AskContextItem[] = [];

	const handleEventBlock = (rawBlock: string) => {
		if (rawBlock.trim() === "") {
			return;
		}

		const { event, data } = parseSSEEventBlock(rawBlock);
		let payload: AskDonePayload = {};
		if (data) {
			try {
				payload = JSON.parse(data) as AskDonePayload;
			} catch {
				payload = {};
			}
		}

		if (event === "delta") {
			const delta =
				typeof payload.answer === "string"
					? payload.answer
					: typeof (payload as { delta?: unknown }).delta === "string"
						? ((payload as { delta?: string }).delta ?? "")
						: "";
			if (delta !== "") {
				accumulatedAnswer += delta;
				onDelta(delta);
			}
			return;
		}

		if (event === "done") {
			doneAnswer = typeof payload.answer === "string" ? payload.answer : "";
			doneContext = parseContextItems(payload.context);
			return;
		}

		if (event === "error") {
			const errorText =
				typeof payload.error === "string" && payload.error.trim() !== ""
					? payload.error
					: "Ошибка стриминга ответа";
			throw new Error(errorText);
		}
	};

	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true });
		buffer = buffer.replace(/\r/g, "");

		let separatorIndex = buffer.indexOf("\n\n");
		for (; separatorIndex !== -1; separatorIndex = buffer.indexOf("\n\n")) {
			const block = buffer.slice(0, separatorIndex);
			buffer = buffer.slice(separatorIndex + 2);
			handleEventBlock(block);
		}
	}

	const flushChunk = decoder.decode();
	if (flushChunk) {
		buffer += flushChunk;
		buffer = buffer.replace(/\r/g, "");
	}
	if (buffer.trim() !== "") {
		handleEventBlock(buffer);
	}

	return {
		answer: doneAnswer || accumulatedAnswer,
		context: doneContext,
	};
};

const getErrorMessage = (err: unknown, fallback: string) => {
	if (
		typeof err === "object" &&
		err !== null &&
		"response" in err &&
		typeof (err as { response?: unknown }).response === "object" &&
		(err as { response?: unknown }).response !== null
	) {
		const response = (err as { response?: { data?: { error?: string } } })
			.response;
		if (response?.data?.error) return response.data.error;
	}

	if (
		typeof err === "object" &&
		err !== null &&
		"message" in err &&
		typeof (err as { message?: unknown }).message === "string"
	) {
		return (err as { message: string }).message;
	}

	return fallback;
};

interface TokenClaims {
	id?: string;
	chat_id?: string;
	username?: string;
	exp?: number;
}

interface HistoryMessage {
	ID?: string;
	id?: string;
	ChatHistoryID?: string;
	chat_history_id?: string;
	Text?: string;
	text?: string;
	Role?: string;
	role?: string;
	CreatedDate?: string;
	created_date?: string;
}

const decodeClaims = (token: string | null): TokenClaims | null => {
	if (!token) return null;
	try {
		const payload = token.split(".")[1];
		const decoded = JSON.parse(atob(payload));
		return decoded as TokenClaims;
	} catch (e) {
		console.error("Failed to decode token", e);
		return null;
	}
};

const normalizeMathDelimiters = (text: string): string => {
	return text
		.replace(/\\\[([\s\S]*?)\\\]/g, (_, expression: string) => {
			const trimmed = expression.trim();
			return trimmed ? `\n$$\n${trimmed}\n$$\n` : "";
		})
		.replace(/\\\(([^\n]*?)\\\)/g, (_, expression: string) => {
			const trimmed = expression.trim();
			return trimmed ? `$${trimmed}$` : "";
		});
};

const renderMarkdown: BubbleProps["contentRender"] = (content) => {
	const markdownText =
		typeof content === "string" ? content : String(content ?? "");

	return (
		<Typography className="chat-markdown max-w-full min-w-0 overflow-hidden wrap-break-word">
			<div className="chat-markdown-content">
				<ReactMarkdown
					remarkPlugins={[remarkGfm, remarkMath]}
					rehypePlugins={[rehypeKatex]}
				>
					{normalizeMathDelimiters(markdownText)}
				</ReactMarkdown>
			</div>
		</Typography>
	);
};

const MOBILE_DRAWER_BREAKPOINT = 768;

function App() {
	const [inputValue, setInputValue] = useState("");
	const { theme, toggleTheme } = useTheme();
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const shouldAutoScrollRef = useRef(true);
	const [isMobileViewport, setIsMobileViewport] = useState<boolean>(
		() => window.innerWidth < MOBILE_DRAWER_BREAKPOINT,
	);

	const initialChatId = window.location.pathname.split("/")[1] || "";
	// Prefer chatId from URL when present, otherwise fall back to localStorage
	const [chatId, setChatId] = useState<string>(
		() => initialChatId || localStorage.getItem("chat_id") || "",
	);
	const [token, setToken] = useState<string | null>(() =>
		localStorage.getItem("chat_token"),
	);
	const [historyId, setHistoryId] = useState<string | null>(null);
	const [claims, setClaims] = useState<TokenClaims | null>(() =>
		decodeClaims(localStorage.getItem("chat_token")),
	);

	const [showLoginModal, setShowLoginModal] = useState(false);
	const [showChatPickerModal, setShowChatPickerModal] = useState<boolean>(
		() => !initialChatId && !localStorage.getItem("chat_id"),
	);
	const [selectedChatId, setSelectedChatId] = useState<string>(
		() => initialChatId || localStorage.getItem("chat_id") || "",
	);

	const hasChatIdFromUrl = Boolean(initialChatId);

	const [messages, setMessages] = useState<
		{
			content: string;
			role: string;
			key: string;
			created?: string;
			sources?: AskContextItem[];
		}[]
	>([]);
	const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
	const [pdfViewerDocId, setPdfViewerDocId] = useState<string | null>(null);
	const [pdfViewerDocName, setPdfViewerDocName] = useState<string>("");
	const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
	const [pdfDownloadLoading, setPdfDownloadLoading] = useState(false);
	const [streamingMessageKey, setStreamingMessageKey] = useState<string | null>(
		null,
	);

	const isNearBottom = (element: HTMLDivElement) => {
		const threshold = 96;
		const distanceFromBottom =
			element.scrollHeight - element.scrollTop - element.clientHeight;
		return distanceFromBottom <= threshold;
	};

	const handleMessagesScroll = () => {
		const element = messagesContainerRef.current;
		if (!element) return;
		shouldAutoScrollRef.current = isNearBottom(element);
	};

	useEffect(() => {
		const mediaQuery = window.matchMedia(
			`(max-width: ${MOBILE_DRAWER_BREAKPOINT - 1}px)`,
		);

		const updateViewport = (event: MediaQueryList | MediaQueryListEvent) => {
			setIsMobileViewport(event.matches);
		};

		updateViewport(mediaQuery);
		const handleChange = (event: MediaQueryListEvent) => updateViewport(event);
		mediaQuery.addEventListener("change", handleChange);

		return () => {
			mediaQuery.removeEventListener("change", handleChange);
		};
	}, []);

	useEffect(() => {
		setAuthHeader(token);
		if (!token) {
			localStorage.removeItem("chat_token");
		} else {
			localStorage.setItem("chat_token", token);
			setClaims(decodeClaims(token));
		}
	}, [token]);

	useEffect(() => {
		if (chatId) {
			localStorage.setItem("chat_id", chatId);
			window.history.replaceState({}, "", `/${chatId}`);
			setShowChatPickerModal(false);
			setSelectedChatId(chatId);
		} else {
			setShowChatPickerModal(true);
		}
	}, [chatId]);

	const { data: chatsData, isLoading: chatsLoading } = useQuery({
		queryKey: ["chats-for-picker"],
		queryFn: () =>
			api.instance.get<Array<{ id?: string; name?: string; descr?: string }>>(
				"/public/chats",
			),
		enabled: showChatPickerModal,
	});

	const chatPickerOptions = (chatsData?.data ?? []).map((chat) => {
		const label = chat.name?.trim() || `Чат ${chat.id?.slice(0, 8) ?? ""}`;
		const descr = chat.descr?.trim();
		return {
			value: chat.id ?? "",
			label: descr ? `${label} - ${descr}` : label,
		};
	});

	useEffect(() => {
		if (!claims?.chat_id || !chatId) return;
		if (claims.chat_id !== chatId) {
			setHistoryId(null);
		}
	}, [claims, chatId]);

	const { data: chatSettings, isLoading: settingsLoading } = useQuery({
		queryKey: ["chatSettings", chatId],
		queryFn: () => api.chatSettings.chatDetail(chatId),
		enabled: !!chatId,
	});

	useEffect(() => {
		if (!chatSettings || messages.length > 0) return;
		const initialText =
			chatSettings.data.helloText ?? "Привет! Я ваш помощник. Чем могу помочь?";
		setMessages([
			{
				content: initialText,
				role: "ai",
				key: "ai_0",
			},
		]);
	}, [chatSettings, messages.length]);

	const { data: historyData } = useQuery({
		queryKey: ["chat-history", chatId, historyId],
		enabled: !!chatId && !!historyId,
		queryFn: async () => {
			const res = await api.instance.get(`/chats/${chatId}/history`);
			return res.data as HistoryMessage[];
		},
	});

	useEffect(() => {
		if (!historyData || !historyId) return;
		const filtered = historyData.filter(
			(msg) => (msg.ChatHistoryID || msg.chat_history_id) === historyId,
		);
		if (filtered.length === 0) return;
		const mapped = filtered.map((msg, idx) => ({
			content: msg.Text ?? msg.text ?? "",
			role:
				(msg.Role ?? msg.role ?? "ai") === "assistant"
					? "ai"
					: (msg.Role ?? msg.role ?? "user"),
			key: msg.ID ?? msg.id ?? `history_${idx}`,
			created: msg.CreatedDate ?? msg.created_date,
		}));
		setMessages(mapped);
	}, [historyData, historyId]);

	useEffect(() => {
		const shouldScroll = messages.length > 0;
		if (!shouldScroll) return;
		if (!shouldAutoScrollRef.current) return;

		messagesEndRef.current?.scrollIntoView({
			behavior: streamingMessageKey ? "auto" : "smooth",
			block: "end",
		});
	}, [messages, streamingMessageKey]);

	const getUniqueSources = (context?: AskContextItem[]) => {
		if (!context?.length) return [];

		const map = new Map<string, AskContextItem>();
		for (const item of context) {
			const key = item.DocID || item.DocName || item.Filepath;
			if (!key || map.has(key)) continue;
			map.set(key, item);
		}

		return Array.from(map.values());
	};

	const closePdfViewer = () => {
		setPdfViewerOpen(false);
		setPdfViewerDocId(null);
		setPdfViewerDocName("");
		setPdfViewerUrl(null);
		setPdfDownloadLoading(false);
	};

	const getPdfDownloadPath = (docId: string, authToken: string | null) => {
		if (authToken) {
			return `/documents/${docId}/download`;
		}

		return `/public/documents/${docId}/download`;
	};

	const openPdfViewer = (source: AskContextItem) => {
		if (!source.DocID) {
			message.error("Не удалось открыть документ: отсутствует ID");
			return;
		}

		const effectiveToken = token || localStorage.getItem("chat_token");

		setPdfViewerDocId(source.DocID);
		setPdfViewerDocName(source.DocName || "document.pdf");
		setPdfViewerUrl(getPdfDownloadPath(source.DocID, effectiveToken));
		setPdfViewerOpen(true);
	};

	const downloadPdfViewerDocument = async () => {
		if (!pdfViewerDocId) return;

		const effectiveToken = token || localStorage.getItem("chat_token");
		const downloadPath = getPdfDownloadPath(pdfViewerDocId, effectiveToken);

		setPdfDownloadLoading(true);

		try {
			const res = await api.instance.get(downloadPath, {
				responseType: "blob",
				headers: effectiveToken
					? {
							Authorization: `Bearer ${effectiveToken}`,
						}
					: undefined,
			});
			const blobUrl = URL.createObjectURL(res.data as Blob);
			const link = document.createElement("a");
			link.href = blobUrl;
			link.download = pdfViewerDocName || "document.pdf";
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(blobUrl);
		} catch (err: unknown) {
			const status =
				typeof err === "object" &&
				err !== null &&
				"response" in err &&
				typeof (err as { response?: { status?: unknown } }).response?.status ===
					"number"
					? (err as { response?: { status?: number } }).response?.status
					: undefined;

			if (status === 401) {
				message.error("Нет доступа к документу. Войдите в чат заново.");
				setShowLoginModal(true);
				return;
			}

			if (status === 403 && !effectiveToken) {
				message.error(
					"Документ недоступен без авторизации: разрешён только для пользователей с правами.",
				);
				return;
			}

			message.error(getErrorMessage(err, "Не удалось скачать PDF"));
		} finally {
			setPdfDownloadLoading(false);
		}
	};

	const loginMutation = useMutation({
		mutationFn: async (payload: {
			chat_id: string;
			username: string;
			password: string;
		}) => {
			return api.instance.post("/auth/chat/login", payload);
		},
		onSuccess: (res, variables) => {
			message.success("Успешный вход");
			setToken(res.data.token);
			setChatId(variables.chat_id);
			setClaims(decodeClaims(res.data.token));
			setShowLoginModal(false);
		},
		onError: (err: unknown) => {
			const detail = getErrorMessage(err, "Не удалось авторизоваться");
			message.error(detail);
		},
	});

	const createHistoryMutation = useMutation({
		mutationFn: async (payload: { chat_id: string; user_id?: string }) => {
			const postData: { chat_id: string; user_id?: string } = {
				chat_id: payload.chat_id,
			};
			if (payload.user_id) postData.user_id = payload.user_id;
			return api.instance.post("/chat_histories", postData);
		},
		onSuccess: (res) => {
			const id = res.data.ID ?? res.data.id;
			if (id) {
				setHistoryId(id);
			}
		},
		onError: () => message.error("Не удалось создать историю чата"),
	});

	useEffect(() => {
		if (!chatId || historyId || createHistoryMutation.isPending) return;
		const userId = claims?.id ?? undefined;
		createHistoryMutation.mutate({ chat_id: chatId, user_id: userId });
	}, [chatId, claims, historyId, createHistoryMutation]);

	const askMutation = useMutation({
		mutationKey: ["askMutation"],
		mutationFn: async (query: string) => {
			const requestSettings = {
				...(chatSettings?.data.settings ?? {}),
				enableHistory: true,
			};
			const aiMessageKey = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
			setStreamingMessageKey(aiMessageKey);
			setMessages((prev) => [
				...prev,
				{
					content: "",
					role: "ai",
					key: aiMessageKey,
					sources: [],
				},
			]);

			try {
				const response = await streamAskQuestion({
					query,
					chatID: chatId,
					chatHistoryID: historyId,
					model: chatSettings?.data.settings?.model,
					settings: requestSettings,
					token,
					onDelta: (delta) => {
						setMessages((prev) =>
							prev.map((msg) =>
								msg.key === aiMessageKey
									? { ...msg, content: `${msg.content}${delta}` }
									: msg,
							),
						);
					},
				});

				const finalAnswer = response.answer || "";
				const sources = getUniqueSources(response.context);
				setMessages((prev) =>
					prev.map((msg) =>
						msg.key === aiMessageKey
							? {
									...msg,
									content: finalAnswer || msg.content,
									sources,
								}
							: msg,
					),
				);

				return {
					answer: finalAnswer || response.answer || "",
					context: response.context,
				};
			} catch (err) {
				setMessages((prev) => {
					const target = prev.find((msg) => msg.key === aiMessageKey);
					if (!target || target.content.trim() !== "") {
						return prev;
					}
					return prev.filter((msg) => msg.key !== aiMessageKey);
				});
				throw err;
			} finally {
				setStreamingMessageKey((prev) => (prev === aiMessageKey ? null : prev));
			}
		},
		onError: (err: unknown) => {
			message.error(getErrorMessage(err, "Не удалось получить ответ"));
		},
	});

	const sendMessageMutation = useMutation({
		mutationFn: async (text: string) => {
			if (!historyId) throw new Error("history missing");
			await api.instance.post("/messages", {
				chat_history_id: historyId,
				text,
				role: "user",
			});

			const answer = (await askMutation.mutateAsync(text)) as AskResponse;

			await api.instance.post("/messages", {
				chat_history_id: historyId,
				text: answer.answer || "",
				role: "assistant",
			});
		},
		onError: () => message.error("Не удалось отправить сообщение"),
	});

	if (settingsLoading) {
		return (
			<div className="h-screen flex items-center justify-center">
				<Spin size="large" />
			</div>
		);
	}

	return (
		<>
			<XProvider
				theme={{
					token: {
						colorFillContent: theme === "dark" ? "#1351a8" : "#e7e7e7",
						colorText: theme === "dark" ? "#ffffff" : "#000000",
					},
				}}
			>
				<div className="min-h-screen h-full flex flex-col items-center bg-gray-100 dark:bg-gray-900">
					<div className="h-screen md:h-[calc(100vh-2rem)] flex flex-col bg-white dark:bg-gray-800 max-w-lg w-full mx-4 md:mt-4 mb-0 md:rounded-lg shadow-lg transition-colors">
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
											{chatSettings?.data.name || "Чат"}
										</h2>
										{chatSettings?.data.descr && (
											<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
												{chatSettings.data.descr}
											</p>
										)}
									</div>
									<div className="flex items-center gap-2 shrink-0">
										<Button
											type="primary"
											className="text-black whitespace-nowrap"
											onClick={toggleTheme}
										>
											{theme === "light" ? "🌙 Тема" : "☀️ Тема"}
										</Button>
										{token ? (
											<Button
												onClick={() => {
													setToken(null);
													setChatId("");
													setHistoryId(null);
													setMessages([]);
												}}
												type="primary"
											>
												Выйти
											</Button>
										) : (
											<Button
												type="primary"
												onClick={() => setShowLoginModal(true)}
											>
												Войти
											</Button>
										)}
									</div>
								</div>
							</div>
							{!historyId && (
								<div className="px-4 py-3">
									{createHistoryMutation.isPending ? (
										<div className="flex justify-center">
											<Spin />
										</div>
									) : (
										<Alert
											className="bg-blue-100 dark:bg-blue-700 text-black!"
											message="Создаётся история чата"
											type="info"
										/>
									)}
								</div>
							)}
							<div
								ref={messagesContainerRef}
								onScroll={handleMessagesScroll}
								className="flex min-w-0 flex-1 min-h-0 flex-col p-4 gap-4 overflow-y-auto overflow-x-hidden"
							>
								{messages.map((msg) => {
									const isStreamingPlaceholder =
										msg.role === "ai" &&
										msg.key === streamingMessageKey &&
										msg.content.trim() === "";

									return (
										<div
											key={msg.key}
											className={`chat-message max-w-full min-w-0 ${
												msg.role === "user"
													? "chat-message-user"
													: "chat-message-ai"
											}`}
										>
											<Bubble
												className="max-w-full min-w-0 overflow-hidden"
												role={msg.role}
												content={isStreamingPlaceholder ? " " : msg.content}
												contentRender={
													isStreamingPlaceholder
														? () => (
																<div className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
																	<Spin size="small" />
																	<span>Подбираю ответ...</span>
																</div>
															)
														: renderMarkdown
												}
												typing={
													msg.role === "ai" && msg.key === streamingMessageKey
														? true
														: undefined
												}
												autoFocus
												itemType="chat"
												avatar={
													msg.role === "user" ? undefined : (
														<div className="p-2 bg-gray-500 rounded-full w-8 h-8 flex items-center justify-center">
															AI
														</div>
													)
												}
												variant="filled"
												placement={msg.role === "user" ? "end" : "start"}
											/>
											{msg.role === "ai" && (msg.sources?.length ?? 0) > 0 ? (
												<div className="ml-10 mt-2 max-w-full min-w-0 overflow-hidden text-xs text-gray-600 dark:text-gray-300">
													<div className="mb-1">Использованные PDF:</div>
													<div className="flex flex-col gap-1 max-w-full">
														{msg.sources?.map((source) => (
															<button
																key={`${msg.key}_${source.DocID || source.DocName}`}
																type="button"
																className="w-full max-w-full rounded px-1 py-1 text-left leading-5 hover:bg-black/5 dark:hover:bg-white/10"
																title={source.DocName || "Документ"}
																onClick={() => openPdfViewer(source)}
															>
																<span className="inline-flex w-full min-w-0 items-start gap-1.5 text-left">
																	<span
																		aria-hidden="true"
																		className="mt-0.5 shrink-0"
																	>
																		📄
																	</span>
																	<span className="block min-w-0 flex-1 break-all whitespace-normal">
																		{source.DocName || "Документ"}
																	</span>
																</span>
															</button>
														))}
													</div>
												</div>
											) : null}
										</div>
									);
								})}

								{sendMessageMutation.isPending && !askMutation.isPending && (
									<Bubble
										content={<Spin />}
										typing
										autoFocus
										itemType="chat"
										avatar={
											<div className="p-2 bg-gray-500 rounded-full w-8 h-8 flex items-center justify-center">
												AI
											</div>
										}
										variant="filled"
										placement="start"
									/>
								)}
								<div ref={messagesEndRef} />
							</div>
						</div>
						<Sender
							value={inputValue}
							loading={askMutation.isPending || sendMessageMutation.isPending}
							onSubmit={(messageValue) => {
								if (!messageValue.trim()) return;
								if (!historyId) {
									message.error("История чата не создана");
									return;
								}
								shouldAutoScrollRef.current = true;
								setMessages((prev) => [
									...prev,
									{
										content: messageValue,
										role: "user",
										key: `user_${prev.length}`,
									},
								]);
								setInputValue("");
								sendMessageMutation.mutate(messageValue);
							}}
							onChange={setInputValue}
						/>
					</div>
				</div>
			</XProvider>
			<Modal
				open={showLoginModal}
				onCancel={() => setShowLoginModal(false)}
				footer={null}
				destroyOnClose
				getContainer={false}
				classNames={"bg-red"}
				className="bg-white dark:bg-gray-800"
				rootClassName="bg-white dark:bg-gray-800"
			>
				<div className="">
					<Typography.Title level={3}>Вход в чат</Typography.Title>
					<Form
						layout="vertical"
						onFinish={(values) => {
							const effectiveChatId = chatId || values.chatId;
							if (!effectiveChatId) {
								message.error("Укажите Chat ID");
								return;
							}
							loginMutation.mutate({
								chat_id: effectiveChatId,
								username: values.username,
								password: values.password,
							});
						}}
						initialValues={{ chatId }}
					>
						<Form.Item
							label="Chat ID"
							name="chatId"
							hidden={hasChatIdFromUrl}
							rules={
								hasChatIdFromUrl
									? []
									: [{ required: true, message: "Введите chat id" }]
							}
						>
							<Input placeholder="52a5-..." disabled={hasChatIdFromUrl} />
						</Form.Item>
						<Form.Item
							label="Логин"
							name="username"
							rules={[{ required: true, message: "Введите логин" }]}
						>
							<Input />
						</Form.Item>
						<Form.Item
							label="Пароль"
							name="password"
							rules={[{ required: true, message: "Введите пароль" }]}
						>
							<Input.Password />
						</Form.Item>
						<Button
							type="primary"
							htmlType="submit"
							loading={loginMutation.isPending}
							block
						>
							Войти
						</Button>
					</Form>
					<Button type="primary" className="mt-3" onClick={toggleTheme} block>
						{theme === "light" ? "🌙 Темная тема" : "☀️ Светлая тема"}
					</Button>
				</div>
			</Modal>
			<Drawer
				open={pdfViewerOpen}
				onClose={closePdfViewer}
				destroyOnClose
				placement="right"
				title={pdfViewerDocName || "Просмотр PDF"}
				width={isMobileViewport ? "100vw" : "60vw"}
				styles={{ body: { padding: 8 } }}
				footer={
					<div className="flex items-center justify-end gap-3">
						<Button key="close" onClick={closePdfViewer}>
							Закрыть
						</Button>
						<Button
							key="download"
							type="primary"
							disabled={!pdfViewerDocId}
							loading={pdfDownloadLoading}
							onClick={downloadPdfViewerDocument}
						>
							Скачать
						</Button>
					</div>
				}
			>
				<div className="h-[calc(100vh-170px)]">
					{pdfViewerUrl ? (
						<PdfViewer
							key={pdfViewerUrl}
							url={pdfViewerUrl}
							token={token || undefined}
							onUnauthorized={() => {
								message.warning(
									"Нет доступа к документу. Войдите в чат заново.",
								);
								setShowLoginModal(true);
							}}
						/>
					) : (
						<div className="h-full flex items-center justify-center text-gray-500">
							Документ не выбран
						</div>
					)}
				</div>
			</Drawer>
			<Modal
				open={showChatPickerModal}
				title="Выбор чата"
				closable={false}
				maskClosable={false}
				keyboard={false}
				footer={[
					<Button
						key="continue"
						type="primary"
						disabled={!selectedChatId}
						onClick={() => {
							if (!selectedChatId) {
								message.error("Выберите чат");
								return;
							}
							setChatId(selectedChatId);
							setMessages([]);
							setHistoryId(null);
							setShowChatPickerModal(false);
						}}
					>
						Продолжить
					</Button>,
				]}
			>
				<Typography.Paragraph type="secondary">
					Выберите чат из списка.
				</Typography.Paragraph>
				<Select
					showSearch
					placeholder="Найдите чат по названию или описанию"
					value={selectedChatId || undefined}
					onChange={setSelectedChatId}
					loading={chatsLoading}
					filterOption={(input, option) =>
						String(option?.label ?? "")
							.toLowerCase()
							.includes(input.toLowerCase())
					}
					notFoundContent={
						chatsLoading ? <Spin size="small" /> : "Чаты не найдены"
					}
					options={chatPickerOptions}
					style={{ width: "100%" }}
				/>
			</Modal>
			<PWABadge />
		</>
	);
}

export default App;
