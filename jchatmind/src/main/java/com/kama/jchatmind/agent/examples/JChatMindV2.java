package com.kama.jchatmind.agent.examples;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.tool.ToolCallback;

import java.util.ArrayList;
import java.util.List;

/**
 * JChatMindV2 Agent 实现类
 * 简单的 ReAct/Tool Calling 代理，手动管理对话历史
 */
public class JChatMindV2 {

    private final String id;
    private final String name;
    private final String systemPrompt;
    private final ChatClient chatClient;
    private final int memorySize; // 简单的内存大小限制（条数）
    private final String sessionId;
    private final List<ToolCallback> tools;

    // 手动维护的对话历史
    private final List<Message> conversationHistory = new ArrayList<>();

    public JChatMindV2(String id, String name, String systemPrompt, ChatClient chatClient, int memorySize, String sessionId, List<ToolCallback> tools) {
        this.id = id;
        this.name = name;
        this.systemPrompt = systemPrompt;
        this.chatClient = chatClient;
        this.memorySize = memorySize;
        this.sessionId = sessionId;
        this.tools = tools;
    }

    /**
     * 对话核心方法
     * @param userInput 用户输入
     * @return AI 回复
     */
    public String chat(String userInput) {
        // 1. 构建当前请求的消息列表
        // 注意：这里为了演示简单，每次请求都带上了 System Prompt 和 历史记录
        List<Message> messagesToSenD = new ArrayList<>();
        messagesToSenD.add(new SystemMessage(this.systemPrompt));
        messagesToSenD.addAll(this.conversationHistory);
        messagesToSenD.add(new UserMessage(userInput));

        // 2. 使用 ChatClient 发起请求
        // 如果 tools 不为空，则配置 tools
        var promptSpec = chatClient.prompt().messages(messagesToSenD);

        if (this.tools != null && !this.tools.isEmpty()) {
            promptSpec.tools(this.tools.toArray(new ToolCallback[0]));
        }

        String responseContent = promptSpec.call().content();

        // 3. 更新历史记录 (记录用户的输入和AI的回复)
        // 实际生产中应有更复杂的截断策略
        addToHistory(new UserMessage(userInput));
        if (responseContent != null) {
            addToHistory(new AssistantMessage(responseContent));
        }

        return responseContent;
    }

    /**
     * 获取对话历史
     */
    public List<Message> getConversationHistory() {
        return conversationHistory;
    }

    private void addToHistory(Message message) {
        if (conversationHistory.size() >= memorySize) {
            conversationHistory.remove(0); // 简单的 FIFO 策略
        }
        conversationHistory.add(message);
    }
}

