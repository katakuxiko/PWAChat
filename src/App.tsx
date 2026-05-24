import { Bubble, Sender, XProvider, type BubbleProps } from "@ant-design/x";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import PWABadge from "./PWABadge.tsx";
import { useTheme } from "./hooks/useTheme.ts";
import XMarkdown from "@ant-design/x-markdown";
import { useMutation, useQuery } from "@tanstack/react-query";
import api, { setAuthHeader } from "./axios/index.tsx";
import {
	Alert,
	Button,
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

// Хук для анимации печатания текста
const useTypingText = (text: string, speed: number = 30) => {
	const [displayedText, setDisplayedText] = useState("");

	useEffect(() => {
		if (!text) {
			setDisplayedText("");
			return;
		}

		let index = 0;
		setDisplayedText("");

		const interval = setInterval(() => {
			if (index < text.length) {
				setDisplayedText(text.slice(0, index + 1));
				index++;
			} else {
				clearInterval(interval);
			}
		}, speed);

		return () => clearInterval(interval);
	}, [text, speed]);

	return displayedText;
};

const renderMarkdown: BubbleProps["contentRender"] = (content) => {
	return (
		<Typography className="max-w-full min-w-0 overflow-hidden wrap-break-word">
			<XMarkdown content={content} />
		</Typography>
	);
};

function App() {
	const [inputValue, setInputValue] = useState("");
	const { theme, toggleTheme } = useTheme();
	const messagesEndRef = useRef<HTMLDivElement>(null);

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
	const [pdfViewerLoading, setPdfViewerLoading] = useState(false);
	const [pdfViewerError, setPdfViewerError] = useState<string | null>(null);
	const [pdfViewerDocName, setPdfViewerDocName] = useState<string>("");
	const [pdfViewerBlobUrl, setPdfViewerBlobUrl] = useState<string | null>(null);

	const [animatingMessageIndex, setAnimatingMessageIndex] = useState<
		number | null
	>(null);
	const displayedText = useTypingText(
		animatingMessageIndex !== null && animatingMessageIndex >= 0
			? messages[animatingMessageIndex]?.content || ""
			: "",
		5,
	);

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
		const shouldScroll = messages.length > 0 || displayedText.length > 0;
		if (!shouldScroll) return;
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, displayedText]);

	useEffect(() => {
		return () => {
			if (pdfViewerBlobUrl) {
				URL.revokeObjectURL(pdfViewerBlobUrl);
			}
		};
	}, [pdfViewerBlobUrl]);

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
		setPdfViewerError(null);
		setPdfViewerLoading(false);
		if (pdfViewerBlobUrl) {
			URL.revokeObjectURL(pdfViewerBlobUrl);
		}
		setPdfViewerBlobUrl(null);
	};

	const openPdfViewer = async (source: AskContextItem) => {
		if (!source.DocID) {
			message.error("Не удалось открыть документ: отсутствует ID");
			return;
		}

		const effectiveToken = token || localStorage.getItem("chat_token");
		if (!effectiveToken) {
			message.warning("Для просмотра PDF выполните вход в чат");
			setShowLoginModal(true);
			return;
		}

		setPdfViewerDocName(source.DocName || "document.pdf");
		setPdfViewerOpen(true);
		setPdfViewerLoading(true);
		setPdfViewerError(null);

		if (pdfViewerBlobUrl) {
			URL.revokeObjectURL(pdfViewerBlobUrl);
			setPdfViewerBlobUrl(null);
		}

		try {
			const res = await api.instance.get(
				`/documents/${source.DocID}/download`,
				{
					responseType: "blob",
					headers: {
						Authorization: `Bearer ${effectiveToken}`,
					},
				},
			);
			const blobUrl = URL.createObjectURL(res.data as Blob);
			setPdfViewerBlobUrl(blobUrl);
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
				setPdfViewerError("Нет доступа к документу. Войдите в чат заново.");
				setShowLoginModal(true);
				return;
			}

			setPdfViewerError(getErrorMessage(err, "Не удалось загрузить PDF"));
		} finally {
			setPdfViewerLoading(false);
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
			return api.ask.postAsk({
				query,
				chat_id: chatId,
				model: chatSettings?.data.settings?.model,
				settings: chatSettings?.data.settings,
			});
		},
		onSuccess: (data) => {
			const response = (data.data ?? {}) as AskResponse;
			const sources = getUniqueSources(response.context);
			setMessages((prev) => {
				const nextIndex = prev.length;
				setAnimatingMessageIndex(nextIndex);
				return [
					...prev,
					{
						content: response.answer || "",
						role: "ai",
						key: `ai_${nextIndex}`,
						sources,
					},
				];
			});
		},
		onError: () => message.error("Не удалось получить ответ"),
	});

	const sendMessageMutation = useMutation({
		mutationFn: async (text: string) => {
			if (!historyId) throw new Error("history missing");
			await api.instance.post("/messages", {
				chat_history_id: historyId,
				text,
				role: "user",
			});

			const answer = await askMutation.mutateAsync(text);

			await api.instance.post("/messages", {
				chat_history_id: historyId,
				text: ((answer.data ?? {}) as AskResponse).answer,
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
					<div className="flex gap-2 mt-4">
						<Button type="primary" className="text-black" onClick={toggleTheme}>
							{theme === "light" ? "🌙 Темная тема" : "☀️ Светлая тема"}
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
							<Button type="primary" onClick={() => setShowLoginModal(true)}>
								Войти
							</Button>
						)}
					</div>
					<div className="h-[calc(100vh-120px)] flex flex-col justify-between bg-white dark:bg-gray-800 max-w-lg w-full m-4 mb-0 rounded-lg shadow-lg transition-colors">
						<div>
							{chatSettings && (
								<div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
									<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
										{chatSettings.data.name}
									</h2>
									{chatSettings.data.descr && (
										<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
											{chatSettings.data.descr}
										</p>
									)}
								</div>
							)}
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
							<div className="flex min-w-0 flex-col p-4 gap-4 max-h-[calc(100vh-260px)] overflow-y-auto overflow-x-hidden">
								{messages.map((msg, index) => (
									<Bubble
										key={msg.key}
										className="max-w-full min-w-0 overflow-hidden"
										role={msg.role}
										content={
											animatingMessageIndex === index
												? displayedText
												: msg.content
										}
										contentRender={renderMarkdown}
										typing={
											msg.role === "ai" && animatingMessageIndex === index
												? true
												: undefined
										}
										autoFocus
										itemType="chat"
										footer={
											msg.role === "ai" && (msg.sources?.length ?? 0) > 0 ? (
												<div className="mt-2 max-w-full min-w-0 overflow-hidden text-xs text-gray-600 dark:text-gray-300">
													<div className="mb-1">Использованные PDF:</div>
													<div className="flex flex-col gap-1 max-w-full">
														{msg.sources?.map((source) => (
															<Button
																key={`${msg.key}_${source.DocID || source.DocName}`}
																type="text"
																size="small"
																className="w-full max-w-full px-1! text-left! h-auto! overflow-hidden"
																title={source.DocName || "Документ"}
																onClick={() => openPdfViewer(source)}
															>
																<span className="inline-flex w-full min-w-0 items-center gap-1.5 text-left">
																	<span aria-hidden="true">📄</span>
																	<span className="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
																		{source.DocName || "Документ"}
																	</span>
																</span>
															</Button>
														))}
													</div>
												</div>
											) : undefined
										}
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
								))}

								{(askMutation.isPending || sendMessageMutation.isPending) && (
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
			<Modal
				open={pdfViewerOpen}
				onCancel={closePdfViewer}
				title={pdfViewerDocName || "Просмотр PDF"}
				width={1000}
				footer={[
					<Button key="close" onClick={closePdfViewer}>
						Закрыть
					</Button>,
					<Button
						key="download"
						type="primary"
						disabled={!pdfViewerBlobUrl}
						onClick={() => {
							if (!pdfViewerBlobUrl) return;
							const link = document.createElement("a");
							link.href = pdfViewerBlobUrl;
							link.download = pdfViewerDocName || "document.pdf";
							document.body.appendChild(link);
							link.click();
							link.remove();
						}}
					>
						Скачать
					</Button>,
				]}
			>
				<div className="h-[70vh] border border-gray-200 rounded-lg overflow-hidden bg-white">
					{pdfViewerLoading && (
						<div className="h-full flex items-center justify-center">
							<Spin />
						</div>
					)}
					{!pdfViewerLoading && pdfViewerError && (
						<div className="h-full flex items-center justify-center text-red-500 px-4 text-center">
							{pdfViewerError}
						</div>
					)}
					{!pdfViewerLoading && !pdfViewerError && pdfViewerBlobUrl && (
						<iframe
							title={pdfViewerDocName || "PDF Viewer"}
							src={pdfViewerBlobUrl}
							className="w-full h-full"
						/>
					)}
				</div>
			</Modal>
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
