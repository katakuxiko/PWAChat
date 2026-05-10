import { Bubble, Sender, XProvider, type BubbleProps } from "@ant-design/x";
import { useEffect, useRef, useState } from "react";
import "./App.css";
import PWABadge from "./PWABadge.tsx";
import { useTheme } from "./hooks/useTheme.ts";
import XMarkdown from "@ant-design/x-markdown";
import { useMutation, useQuery } from "@tanstack/react-query";
import api, { setAuthHeader } from "./axios/index.tsx";
import { Alert, Button, Form, Input, Spin, Typography, message } from "antd";

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
    <Typography>
      <XMarkdown content={content} />
    </Typography>
  );
};

function App() {
  const [inputValue, setInputValue] = useState("");
  const { theme, toggleTheme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initialChatId = window.location.pathname.split("/")[1] || "";
  const [chatId, setChatId] = useState<string>(
    () => localStorage.getItem("chat_id") || initialChatId,
  );
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("chat_token"),
  );
  const [historyId, setHistoryId] = useState<string | null>(() =>
    localStorage.getItem("chat_history_id"),
  );
  const [claims, setClaims] = useState<TokenClaims | null>(() =>
    decodeClaims(localStorage.getItem("chat_token")),
  );

  const hasChatIdFromUrl = Boolean(initialChatId);

  const [messages, setMessages] = useState<
    { content: string; role: string; key: string; created?: string }[]
  >([]);

  const [animatingMessageIndex, setAnimatingMessageIndex] = useState<
    number | null
  >(null);
  const displayedText = useTypingText(
    animatingMessageIndex !== null && animatingMessageIndex >= 0
      ? messages[animatingMessageIndex]?.content || ""
      : "",
    10,
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
    }
  }, [chatId]);

  useEffect(() => {
    if (!claims?.chat_id || !chatId) return;
    if (claims.chat_id !== chatId) {
      setHistoryId(null);
      localStorage.removeItem("chat_history_id");
    }
  }, [claims, chatId]);

  useEffect(() => {
    if (!historyId) {
      localStorage.removeItem("chat_history_id");
    } else {
      localStorage.setItem("chat_history_id", historyId);
    }
  }, [historyId]);

  const { data: chatSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["chatSettings", chatId],
    queryFn: () => api.chatSettings.chatDetail(chatId),
    enabled: !!chatId && !!token,
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
    enabled: !!chatId && !!token && !!historyId,
    queryFn: async () => {
      const res = await api.instance.get(`/chats/${chatId}/history`);
      return res.data as HistoryMessage[];
    },
    refetchInterval: 5000,
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, displayedText]);

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
    },
    onError: (err: any) => {
      const detail =
        err?.response?.data?.error ||
        err?.message ||
        "Не удалось авторизоваться";
      message.error(detail);
    },
  });

  const createHistoryMutation = useMutation({
    mutationFn: async (payload: { chat_id: string; user_id: string }) => {
      return api.instance.post("/chat_histories", payload);
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
    if (
      !token ||
      !chatId ||
      !claims?.id ||
      historyId ||
      createHistoryMutation.isPending
    )
      return;
    createHistoryMutation.mutate({ chat_id: chatId, user_id: claims.id });
  }, [token, chatId, claims, historyId, createHistoryMutation]);

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
      setMessages((prev) => {
        const nextIndex = prev.length;
        setAnimatingMessageIndex(nextIndex);
        return [
          ...prev,
          {
            content: data.data.answer,
            role: "ai",
            key: `ai_${nextIndex}`,
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
        text: answer.data.answer,
        role: "assistant",
      });
    },
    onError: () => message.error("Не удалось отправить сообщение"),
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-md">
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
          <Button className="mt-3" onClick={toggleTheme} block>
            {theme === "light" ? "🌙 Темная тема" : "☀️ Светлая тема"}
          </Button>
        </div>
      </div>
    );
  }

  if (!historyId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {createHistoryMutation.isPending ? (
          <Spin size="large" />
        ) : (
          <Alert message="Создайте историю чата" type="info" />
        )}
      </div>
    );
  }

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
            <Button onClick={toggleTheme}>
              {theme === "light" ? "🌙 Темная тема" : "☀️ Светлая тема"}
            </Button>
            <Button
              onClick={() => {
                setToken(null);
                setHistoryId(null);
                setMessages([]);
              }}
            >
              Выйти
            </Button>
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
              <div className="flex flex-col p-4 gap-4 max-h-[calc(100vh-260px)] overflow-y-auto">
                {messages.map((msg, index) => (
                  <Bubble
                    key={msg.key}
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
      <PWABadge />
    </>
  );
}

export default App;
