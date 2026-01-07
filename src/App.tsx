import { Bubble, Sender, XProvider } from "@ant-design/x";
import { useEffect, useState } from "react";
import "./App.css";
import PWABadge from "./PWABadge.tsx";
import { useTheme } from "./hooks/useTheme.ts";
import XMarkdown from "@ant-design/x-markdown";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from "./axios/index.tsx";
import { Spin } from "antd";

function App() {
	const [inputValue, setInputValue] = useState("");
	const { theme, toggleTheme } = useTheme();

	const chat_id = window.location.pathname.split("/")[1];

	// Загружаем настройки чата
	const { data: chatSettings, isLoading: settingsLoading } = useQuery({
		queryKey: ["chatSettings", chat_id],
		queryFn: () => api.chatSettings.chatDetail(chat_id),
		enabled: !!chat_id,
	});

	const [messages, setMessages] = useState<
		{ content: string; role: "user" | "ai"; key: string }[]
	>([]);

	const { mutate, isPending, isSuccess } = useMutation({
		mutationKey: ["askMutation"],
		mutationFn: async (query: string) => {
			return api.ask.postAsk({
				query,
				chat_id: chat_id,
				// Передаем параметры модели из настроек
				model: chatSettings?.data.settings?.model,
				settings: {
					temperature: chatSettings?.data.settings?.temperature,
					maxTokens: chatSettings?.data.settings?.maxTokens,
					systemPrompt: chatSettings?.data.settings?.systemPrompt,
					model: chatSettings?.data.settings?.model,
				},
			});
		},
		onSuccess: (data) => {
			setMessages((prev) => [
				...prev,
				{
					content: data.data.answer,
					role: "ai",
					key: `ai_${prev.length}`,
				},
			]);
		},
	});

	useEffect(() => {
		if (chatSettings && messages.length === 0) {
			const initialMessages = chatSettings.data.helloText;
			setMessages([
				{
					content:
						initialMessages ?? "Привет! Я ваш помощник. Чем могу помочь?",
					role: "ai",
					key: "ai_0",
				},
			]);
		}
	}, [chatSettings, messages.length]);

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
					<button
						className="px-4 py-2 mt-4 rounded-lg  bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
						onClick={toggleTheme}
						type="button"
					>
						{theme === "light" ? "🌙 Темная тема" : "☀️ Светлая тема"}
					</button>
					<div className="h-[calc(100vh-96px)] flex flex-col justify-between bg-white dark:bg-gray-800 max-w-lg w-full m-4 mb-0 rounded-lg shadow-lg transition-colors">
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
							<div className="flex flex-col p-4 gap-4 max-h-[calc(100vh-232px)] overflow-y-auto">
								{messages.map((msg) => (
									<Bubble
										key={msg.key}
										role={msg.role}
										content={msg.content}
										typing={msg.role === "ai" ? true : undefined}
										autoFocus
										itemType="asd"
										avatar={
											msg.role === "user" ? undefined : (
												<div className="p-2 bg-gray-500 rounded-full w-8 h-8 flex items-center justify-center">
													AI
												</div>
											)
										}
										variant="filled"
										footer={
											msg.role === "user" ? undefined : <div>AI footer</div>
										}
										placement={msg.role === "user" ? "end" : "start"}
									>
										<XMarkdown>{msg.content}</XMarkdown>
									</Bubble>
								))}

								{isPending && !isSuccess && (
									<Bubble
										content={<Spin />}
										typing
										autoFocus
										itemType="asd"
										avatar={
											<div className="p-2 bg-gray-500 rounded-full w-8 h-8 flex items-center justify-center">
												AI
											</div>
										}
										variant="filled"
										placement="start"
									/>
								)}
							</div>
						</div>
						<Sender
							value={inputValue}
							loading={isPending}
							onSubmit={(message) => {
								mutate(message);
								setMessages((prev) => [
									...prev,
									{
										content: message,
										role: "user",
										key: `user_${prev.length}`,
									},
								]);
								setInputValue("");
							}}
							onChange={setInputValue}
						/>
					</div>
				</div>
			</XProvider>
			<PWABadge />
		</>
	);
}

export default App;
