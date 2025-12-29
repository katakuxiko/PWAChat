import { Bubble, Sender, XProvider } from "@ant-design/x";
import { useState } from "react";
import "./App.css";
import PWABadge from "./PWABadge.tsx";
import { useTheme } from "./hooks/useTheme.ts";
import XMarkdown from "@ant-design/x-markdown";

const message = [
	{
		content: "Hello, Ant Design X! ***asd***",
		role: "ai",
		key: "ai_0",
	},
];

function App() {
	const [messages, setMessages] = useState(message);
	const [inputValue, setInputValue] = useState("");
	const { theme, toggleTheme } = useTheme();

	return (
		<>
			<XProvider
				theme={{
					token: {
						colorFillContent:
							theme === "dark" ? "#1351a8" : "#e7e7e7",
						colorText: theme === "dark" ? "#ffffff" : "#000000",
					},
				}}
			>
				<div className="h-screen flex flex-col items-center bg-gray-100 dark:bg-gray-900">
					<button
						className="px-4 py-2 mt-4 rounded-lg  bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
						onClick={toggleTheme}
					>
						{theme === "light"
							? "🌙 Темная тема"
							: "☀️ Светлая тема"}
					</button>
					<div className="h-screen flex flex-col justify-between bg-white dark:bg-gray-800 max-w-lg w-full m-4 mb-0 rounded-lg shadow-lg transition-colors">
						<div className="flex flex-col p-4 gap-4 max-h-[calc(100vh-132px)] overflow-y-auto">
							{messages.map((msg) => (
								<Bubble
									key={msg.key}
									role={msg.role}
									content={msg.content}
									typing={
										msg.role === "ai" ? true : undefined
									}
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
										msg.role === "user" ? undefined : (
											<div>AI footer</div>
										)
									}
									placement={
										msg.role === "user" ? "end" : "start"
									}
								>
									<XMarkdown>{msg.content}</XMarkdown>
								</Bubble>
							))}
						</div>
						<Sender
							value={inputValue}
							onSubmit={(message) => {
								setMessages((val) => [
									...val,
									{
										content: message,
										role: "user",
										key: `user_${val.length}`,
									},
									{
										content: message.repeat(12),
										role: "ai",
										key: `ai_${val.length}`,
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
