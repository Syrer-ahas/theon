local Players=game:GetService('Players')
local SocialService=game:GetService('SocialService')
local TweenService=game:GetService('TweenService')
local StarterGui=game:GetService('StarterGui')
local player=Players.LocalPlayer
local hud=player:WaitForChild('PlayerGui'):WaitForChild('PlayerStatusHUD'):WaitForChild('HUD')
local buttons={hud:WaitForChild('Friends'),hud:WaitForChild('Premium'),hud:WaitForChild('Newsletter')}
local origins={}
local scales={}
local tweens={}
local hovered
for i,button in buttons do
 origins[i]=button.Position
 local scale=button:FindFirstChild('HoverScale') or Instance.new('UIScale',button);scale.Name='HoverScale';scales[i]=scale
end
local function animate(object,properties)
 if tweens[object] then tweens[object]:Cancel() end
 local tween=TweenService:Create(object,TweenInfo.new(.17,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),properties)
 tweens[object]=tween;tween:Play()
end
local function arrange()
 for i,button in buttons do
  local shift=hovered and i~=hovered and (i<hovered and -6 or 6) or 0
  animate(button,{Position=origins[i]+UDim2.fromOffset(shift,0)})
  animate(scales[i],{Scale=hovered==i and 1.15 or 1})
 end
end
for i,button in buttons do
 button.MouseEnter:Connect(function() hovered=i;arrange() end)
 button.MouseLeave:Connect(function() if hovered==i then hovered=nil;arrange() end end)
end
local function refresh()
 hud.Friends.FriendBonus.Text='+'..tostring(player:GetAttribute('FriendCashBonus') or 0)..'%'
 hud.Premium.PremiumBonus.Text='+'..tostring(player:GetAttribute('PlusCashBonus') or 0)..'%'
end
player:GetAttributeChangedSignal('FriendCashBonus'):Connect(refresh)
player:GetAttributeChangedSignal('PlusCashBonus'):Connect(refresh)
refresh()
local busy=false
buttons[1].Activated:Connect(function()
 if busy then return end;busy=true
 local ok,allowed=pcall(function() return SocialService:CanSendGameInviteAsync(player) end)
 local shown=false
 if ok and allowed then shown=pcall(function() SocialService:PromptGameInvite(player) end) end
 if not shown then
  pcall(function() StarterGui:SetCore('SendNotification',{Title='Invite friends',Text='Roblox invites are unavailable in this session. Try in the Roblox app.',Duration=4}) end)
 end
 task.delay(1,function() busy=false end)
end)
