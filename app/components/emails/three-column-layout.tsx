"use client";

import { useState } from "react";
import { EmailList } from "./email-list";
import { AllEmailsList } from "./all-emails-list";
import { AllMessagesList } from "./all-messages-list";
import { MessageList } from "./message-list";
import { MessageView } from "./message-view";
import { cn } from "@/lib/utils";
import { useCopy } from "@/hooks/use-copy";
import { useRolePermission } from "@/hooks/use-role-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { Copy, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Email {
  id: string;
  address: string;
}

export function ThreeColumnLayout() {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null
  );
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"my" | "all">("my");
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [timeFilter, setTimeFilter] = useState<string>("60");
  const { copyToClipboard } = useCopy();
  const { checkPermission } = useRolePermission();

  const canViewAllEmails = checkPermission(PERMISSIONS.MANAGE_EMAIL);

  const handleViewAll = () => {
    setShowAllMessages(true);
    setSelectedEmail(null);
    setSelectedMessageId(null);
    setSelectedEmailId(null);
  };

  const handleMessageSelect = (emailId: string, messageId: string) => {
    setSelectedEmailId(emailId);
    setSelectedMessageId(messageId);
    // 如果需要，可以根据emailId设置selectedEmail
    setSelectedEmail({ id: emailId, address: "" });
  };

  const columnClass =
    "border-2 border-primary/20 bg-background rounded-lg overflow-hidden flex flex-col";
  const headerClass =
    "p-2 border-b-2 border-primary/20 flex items-center justify-between shrink-0";
  const titleClass = "text-sm font-bold px-2 w-full overflow-hidden";

  // 移动端视图逻辑
  const getMobileView = () => {
    if (selectedMessageId) return "message";
    if (selectedEmail) return "emails";
    return "list";
  };

  const mobileView = getMobileView();

  const copyEmailAddress = () => {
    copyToClipboard(selectedEmail?.address || "");
  };

  return (
    <div className="pb-5 pt-20 h-full flex flex-col">
      {/* 桌面端三栏布局 */}
      <div className="hidden lg:grid grid-cols-12 gap-4 h-full min-h-0">
        <div className={cn("col-span-3", columnClass)}>
          <div className={headerClass}>
            <div className="flex items-center justify-between w-full">
              <h2 className={cn(titleClass, "flex-1")}>
                {viewMode === "my" ? "我的邮箱" : "所有邮箱"}
              </h2>
              {canViewAllEmails && (
                <div className="flex gap-1">
                  <Button
                    variant={viewMode === "my" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setViewMode("my");
                      setSelectedEmail(null);
                      setSelectedMessageId(null);
                      setShowAllMessages(false);
                    }}
                    className="h-6 px-2 text-xs"
                  >
                    <User className="w-3 h-3 mr-1" />
                    我的
                  </Button>
                  <Button
                    variant={viewMode === "all" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setViewMode("all");
                      setSelectedEmail(null);
                      setSelectedMessageId(null);
                      setShowAllMessages(false);
                    }}
                    className="h-6 px-2 text-xs"
                  >
                    <Users className="w-3 h-3 mr-1" />
                    所有
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {viewMode === "my" ? (
              <EmailList
                onEmailSelect={(email) => {
                  setSelectedEmail(email);
                  setSelectedMessageId(null);
                }}
                selectedEmailId={selectedEmail?.id}
              />
            ) : (
              <AllEmailsList
                onEmailSelect={(email) => {
                  setSelectedEmail(email);
                  setSelectedMessageId(null);
                  setShowAllMessages(false);
                }}
                selectedEmailId={selectedEmail?.id}
                onViewAll={handleViewAll}
                timeFilter={timeFilter}
                onTimeFilterChange={setTimeFilter}
              />
            )}
          </div>
        </div>

        <div className={cn("col-span-4", columnClass)}>
          <div className={headerClass}>
            <h2 className={titleClass}>
              {showAllMessages ? (
                "所有消息"
              ) : selectedEmail ? (
                <div className="w-full flex items-center gap-2">
                  <span className="truncate min-w-0">
                    {selectedEmail.address}
                  </span>
                  <div
                    className="shrink-0 cursor-pointer text-primary"
                    onClick={copyEmailAddress}
                  >
                    <Copy className="size-4" />
                  </div>
                </div>
              ) : (
                "选择邮箱查看消息"
              )}
            </h2>
          </div>
          {showAllMessages ? (
            <div className="flex-1 overflow-auto">
              <AllMessagesList
                onMessageSelect={handleMessageSelect}
                selectedMessageId={selectedMessageId}
                timeFilter={timeFilter}
              />
            </div>
          ) : (
            selectedEmail && (
              <div className="flex-1 overflow-auto">
                <MessageList
                  email={selectedEmail}
                  onMessageSelect={setSelectedMessageId}
                  selectedMessageId={selectedMessageId}
                  viewMode={viewMode}
                />
              </div>
            )
          )}
        </div>

        <div className={cn("col-span-5", columnClass)}>
          <div className={headerClass}>
            <h2 className={titleClass}>
              {selectedMessageId ? "邮件内容" : "选择邮件查看详情"}
            </h2>
          </div>
          {(selectedEmail || selectedEmailId) && selectedMessageId && (
            <div className="flex-1 overflow-auto">
              <MessageView
                emailId={selectedEmailId || selectedEmail?.id || ""}
                messageId={selectedMessageId}
                onClose={() => setSelectedMessageId(null)}
                isAdminView={viewMode === "all" || showAllMessages}
              />
            </div>
          )}
        </div>
      </div>

      {/* 移动端单栏布局 */}
      <div className="lg:hidden h-full min-h-0">
        <div className={cn("h-full", columnClass)}>
          {mobileView === "list" && (
            <>
              <div className={headerClass}>
                <div className="flex items-center justify-between w-full">
                  <h2 className={cn(titleClass, "flex-1")}>
                    {viewMode === "my" ? "我的邮箱" : "所有邮箱"}
                  </h2>
                  {canViewAllEmails && (
                    <div className="flex gap-1">
                      <Button
                        variant={viewMode === "my" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => {
                          setViewMode("my");
                          setSelectedEmail(null);
                          setSelectedMessageId(null);
                          setShowAllMessages(false);
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <User className="w-3 h-3 mr-1" />
                        我的
                      </Button>
                      <Button
                        variant={viewMode === "all" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => {
                          setViewMode("all");
                          setSelectedEmail(null);
                          setSelectedMessageId(null);
                          setShowAllMessages(false);
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <Users className="w-3 h-3 mr-1" />
                        所有
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {viewMode === "my" ? (
                  <EmailList
                    onEmailSelect={(email) => {
                      setSelectedEmail(email);
                    }}
                    selectedEmailId={selectedEmail?.id}
                  />
                ) : (
                  <AllEmailsList
                    onEmailSelect={(email) => {
                      setSelectedEmail(email);
                      setShowAllMessages(false);
                    }}
                    selectedEmailId={selectedEmail?.id}
                    onViewAll={handleViewAll}
                    timeFilter={timeFilter}
                    onTimeFilterChange={setTimeFilter}
                  />
                )}
              </div>
            </>
          )}

          {mobileView === "emails" && selectedEmail && (
            <div className="h-full flex flex-col">
              <div className={cn(headerClass, "gap-2")}>
                <button
                  onClick={() => {
                    setSelectedEmail(null);
                  }}
                  className="text-sm text-primary shrink-0"
                >
                  ← 返回邮箱列表
                </button>
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="truncate min-w-0 flex-1 text-right">
                    {selectedEmail.address}
                  </span>
                  <div
                    className="shrink-0 cursor-pointer text-primary"
                    onClick={copyEmailAddress}
                  >
                    <Copy className="size-4" />
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <MessageList
                  email={selectedEmail}
                  onMessageSelect={setSelectedMessageId}
                  selectedMessageId={selectedMessageId}
                />
              </div>
            </div>
          )}

          {mobileView === "message" &&
            (selectedEmail || selectedEmailId) &&
            selectedMessageId && (
              <div className="h-full flex flex-col">
                <div className={headerClass}>
                  <button
                    onClick={() => setSelectedMessageId(null)}
                    className="text-sm text-primary"
                  >
                    ← 返回消息列表
                  </button>
                  <span className="text-sm font-medium">邮件内容</span>
                </div>
                <div className="flex-1 overflow-auto">
                  <MessageView
                    emailId={selectedEmailId || selectedEmail?.id || ""}
                    messageId={selectedMessageId}
                    onClose={() => setSelectedMessageId(null)}
                    isAdminView={viewMode === "all" || showAllMessages}
                  />
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
