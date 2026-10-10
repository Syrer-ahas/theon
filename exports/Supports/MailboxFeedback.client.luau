local Players = game:GetService("Players")
local ProximityPromptService = game:GetService("ProximityPromptService")
local SocialService = game:GetService("SocialService")
local RunService = game:GetService("RunService")
local StarterGui = game:GetService("StarterGui")
local player = Players.LocalPlayer
local busy = false
local lastPromptAt = -math.huge
local function notify(text)
 pcall(function()
  StarterGui:SetCore("SendNotification",{
   Title="Send Feedback!",Text=text,Duration=6,
  })
 end)
end
ProximityPromptService.PromptTriggered:Connect(function(prompt, triggeringPlayer)
 if prompt:GetAttribute("FeedbackPrompt") ~= true then return end
 if triggeringPlayer and triggeringPlayer ~= player then return end
 if busy or os.clock()-lastPromptAt < 1 then return end
 lastPromptAt=os.clock()
 task.spawn(function()
  busy=true
  player:SetAttribute("MailboxFeedbackStatus","Opening")
  if RunService:IsStudio() then
   player:SetAttribute("MailboxFeedbackStatus","StudioUnsupported")
   notify("Roblox feedback opens in the published game. Test it in the Roblox app.")
   busy=false
   return
  end
  local ok,err=pcall(function()
   SocialService:PromptFeedbackSubmissionAsync()
  end)
  if ok then
   player:SetAttribute("MailboxFeedbackStatus","Closed")
  else
   player:SetAttribute("MailboxFeedbackStatus","Failed")
   warn("Roblox feedback could not open: "..tostring(err))
   notify("Roblox feedback could not open right now. Please try again later.")
  end
  busy=false
 end)
end)
