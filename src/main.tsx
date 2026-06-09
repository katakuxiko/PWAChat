import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "katex/dist/katex.min.css";
import App from "./App.tsx";
import { ConfigProvider } from "antd";
import ruRU from "antd/locale/ru_RU";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

dayjs.locale("ru");

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ConfigProvider locale={ruRU}>
			<QueryClientProvider client={queryClient}>
				<App />
			</QueryClientProvider>
		</ConfigProvider>
	</StrictMode>,
);
