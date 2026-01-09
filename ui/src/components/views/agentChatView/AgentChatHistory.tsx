import React, { useState, useRef, useEffect, useCallback } from "react";
import { Avatar } from "antd";
import { Bubble } from "@ant-design/x";
import XMarkdown from "@ant-design/x-markdown";
import {
  ToolOutlined,
  CheckCircleOutlined,
  RobotOutlined,
  DownOutlined,
  RightOutlined,
  UserOutlined,
  CopyOutlined,
  ReloadOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import type { ChatMessageVO, SseMessageType, ToolCall, ToolResponse } from "../../../types";

interface AgentChatHistoryProps {
  messages: ChatMessageVO[];
  displayAgentStatus?: boolean;
  agentStatusText?: string;
  agentStatusType?: SseMessageType;
  onRegenerate?: (message: ChatMessageVO) => void;
}

// 工具调用展示组件（简化版，用于 assistant 消息内）
const ToolCallDisplay: React.FC<{ toolCall: ToolCall }> = ({ toolCall }) => {
  let parsedArgs: Record<string, unknown> = {};
  try {
    parsedArgs = JSON.parse(toolCall.arguments) as Record<string, unknown>;
  } catch {
    // 如果解析失败，使用原始字符串
  }

  const argCount = Object.keys(parsedArgs).length;
  const argPreview = argCount > 0 
    ? Object.keys(parsedArgs).slice(0, 2).join(", ") + (argCount > 2 ? "..." : "")
    : toolCall.arguments.slice(0, 50) + (toolCall.arguments.length > 50 ? "..." : "");

  return (
    <div className="text-xs text-gray-500 flex items-center gap-1.5">
      <ToolOutlined className="text-blue-500" />
      <span className="font-mono text-blue-600">{toolCall.name}</span>
      {argPreview && (
        <>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500 truncate max-w-[200px]">{argPreview}</span>
        </>
      )}
    </div>
  );
};

// 工具响应展示组件（可折叠）
const ToolResponseDisplay: React.FC<{ toolResponse: ToolResponse }> = ({
  toolResponse,
}) => {
  const [expanded, setExpanded] = useState(false);
  
  let parsedData: unknown = null;
  let isJson = false;
  let dataPreview;

  try {
    parsedData = JSON.parse(toolResponse.responseData);
    isJson = true;
    const jsonStr = JSON.stringify(parsedData);
    dataPreview = jsonStr.length > 100 ? jsonStr.slice(0, 100) + "..." : jsonStr;
  } catch {
    dataPreview = toolResponse.responseData.length > 100 
      ? toolResponse.responseData.slice(0, 100) + "..." 
      : toolResponse.responseData;
  }

  return (
    <div className="my-1.5 text-xs">
      <div 
        className="flex items-center gap-2 text-gray-500 cursor-pointer hover:text-gray-700 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <DownOutlined className="text-gray-400" />
        ) : (
          <RightOutlined className="text-gray-400" />
        )}
        <CheckCircleOutlined className="text-green-500" />
        <span className="font-mono text-green-600">{toolResponse.name}</span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-500 truncate flex-1">{dataPreview}</span>
      </div>
      {expanded && (
        <div className="ml-5 mt-1.5 p-2 bg-gray-50 rounded border border-gray-200">
          <div className="text-xs text-gray-600 font-mono">
            {isJson ? (
              <pre className="whitespace-pre-wrap break-words overflow-x-auto max-h-60 overflow-y-auto">
                {JSON.stringify(parsedData, null, 2)}
              </pre>
            ) : (
              <div className="whitespace-pre-wrap break-words">
                {toolResponse.responseData}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// 模拟打字机效果的 Markdown 组件
const TypewriterMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const [displayedContent, setDisplayedContent] = useState("");
  const contentRef = useRef(content);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const fullContent = contentRef.current;
      if (currentIndexRef.current < fullContent.length) {
        // 动态计算步长：如果落后很多则加速
        const diff = fullContent.length - currentIndexRef.current;
        const step = diff > 50 ? 5 : (diff > 10 ? 2 : 1);

        currentIndexRef.current = Math.min(currentIndexRef.current + step, fullContent.length);
        setDisplayedContent(fullContent.slice(0, currentIndexRef.current));
      }
    }, 30); // 约 33ms 一帧

    return () => clearInterval(intervalId);
  }, []);

  return (
    <XMarkdown
      streaming={{
        enableAnimation: true,
      }}
    >
      {displayedContent}
    </XMarkdown>
  );
};

const AgentChatHistory: React.FC<AgentChatHistoryProps> = ({
  messages,
  displayAgentStatus = false,
  agentStatusText = "",
  agentStatusType,
  onRegenerate,
}) => {
  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // 是否允许自动滚动（用户是否接近底部）
  const [isNearBottom, setIsNearBottom] = useState(true);
  // 容错阈值（像素）
  const SCROLL_THRESHOLD = 20;
  // 上一次消息数量，用于检测新消息
  const prevMessagesLengthRef = useRef(messages.length);

  // 检查是否接近底部
  const checkIfNearBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return false;

    const { scrollTop, clientHeight, scrollHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= SCROLL_THRESHOLD;
  }, []);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 使用 requestAnimationFrame 确保 DOM 更新完成后再滚动
    requestAnimationFrame(() => {
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }, []);

  // 处理滚动事件，实时更新是否接近底部的状态
  const handleScroll = useCallback(() => {
    const nearBottom = checkIfNearBottom();
    setIsNearBottom(nearBottom);
  }, [checkIfNearBottom]);

  // 监听滚动事件
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 初始化时检查是否在底部（延迟执行以避免同步 setState）
    const initTimer = setTimeout(() => {
      setIsNearBottom(checkIfNearBottom());
    }, 0);

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      clearTimeout(initTimer);
      container.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll, checkIfNearBottom]);

  // 监听消息变化，决定是否自动滚动
  useEffect(() => {
    const hasNewMessage = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;

    // 如果有新消息且用户接近底部，则自动滚动
    if (hasNewMessage && isNearBottom) {
      scrollToBottom();
    }
  }, [messages, isNearBottom, scrollToBottom]);

  // 当 displayAgentStatus 变化时，如果用户接近底部，也自动滚动
  useEffect(() => {
    if (displayAgentStatus && isNearBottom) {
      scrollToBottom();
    }
  }, [displayAgentStatus, isNearBottom, scrollToBottom]);

  // 获取状态标签
  const getStatusLabel = () => {
    switch (agentStatusType) {
      case "AI_PLANNING":
        return "规划中";
      case "AI_THINKING":
        return "思考中";
      case "AI_EXECUTING":
        return "执行中";
      default:
        return "处理中";
    }
  };

  // 处理复制到剪贴板
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    // 这里可以使用 message.success("复制成功")，但需要确保 antd message 在这里可用或者父组件传递
    // 简单起见，这里假设用户知道复制了
  };

  return (
    <div 
      ref={scrollContainerRef}
      className="flex-1 px-16 pt-4 overflow-y-scroll relative"
    >
      {messages.map((message, index) => {
        const isLast = index === messages.length - 1;
        return (
          <div className="mb-4 group" key={message.id}>
            {/* Assistant 消息 */}
            {message.role === "assistant" && (
              <div className="flex flex-col items-start">
                <Bubble
                  avatar={<Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1677ff' }} />}
                  content={
                    <div className="w-full">
                      {/* 工具调用展示 */}
                      {message.metadata?.toolCalls &&
                        message.metadata.toolCalls.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {message.metadata.toolCalls.map((toolCall) => (
                              <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
                            ))}
                          </div>
                        )}
                      {/* 消息内容 */}
                      {message.content && (
                        <div>
                          {isLast ? (
                            <TypewriterMarkdown content={message.content} />
                          ) : (
                            <XMarkdown>{message.content}</XMarkdown>
                          )}
                        </div>
                      )}
                    </div>
                  }
                  placement="start"
                />

                {/* 操作按钮栏 - 默认隐藏，hover显示，或者最后一条一直显示 */}
                <div className={`ml-10 mt-1 flex gap-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ${isLast ? 'opacity-100' : ''}`}>
                  <div
                    className="cursor-pointer hover:text-blue-500 flex items-center gap-1 text-xs"
                    onClick={() => handleCopy(message.content)}
                    title="复制内容"
                  >
                    <CopyOutlined />
                  </div>
                  {isLast && !displayAgentStatus && (
                    <div
                      className="cursor-pointer hover:text-blue-500 flex items-center gap-1 text-xs"
                      onClick={() => onRegenerate && onRegenerate(message)}
                      title="重新生成"
                    >
                      <ReloadOutlined />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tool 消息 - 简洁展示，不使用气泡 */}
            {message.role === "tool" && message.metadata?.toolResponse && (
              <div className="flex justify-start pl-12">
                <div className="max-w-[85%]">
                  <ToolResponseDisplay toolResponse={message.metadata.toolResponse} />
                </div>
              </div>
            )}

            {/* User 消息 */}
            {message.role === "user" && (
              <Bubble
                avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />}
                content={message.content}
                placement="end"
              />
            )}

            {/* System 消息 */}
            {message.role === "system" && (
              <div className="flex justify-center">
                <div className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full flex items-center gap-1">
                  <RobotOutlined />
                  <span>{message.content}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {displayAgentStatus && (
        <div className="mb-3">
          <div
            className="animate-pulse"
            style={{
              animation: "pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              filter: "brightness(1.15)",
            }}
          >
            <Bubble
              avatar={<Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1677ff' }} />}
              content={
                <span className="flex items-center gap-2">
                  <span
                    className="font-semibold text-blue-600"
                    style={{
                      animation:
                        "pulse 0.7s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                      textShadow:
                        "0 0 10px rgba(37, 99, 235, 1), 0 0 20px rgba(37, 99, 235, 0.8), 0 0 30px rgba(37, 99, 235, 0.5)",
                      filter: "brightness(1.3)",
                    }}
                  >
                    ✨ {getStatusLabel()}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-600">{agentStatusText}</span>
                </span>
              }
              placement="start"
            />
          </div>
        </div>
      )}
      {/* 滚动到底部按钮 */}
      {!isNearBottom && (
        <div
          className="fixed bottom-24 right-8 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:bg-gray-50 text-gray-600 border border-gray-200 z-10"
          onClick={scrollToBottom}
          title="滚动到底部"
        >
          <ArrowDownOutlined />
        </div>
      )}
    </div>
  );
};

export default AgentChatHistory;
