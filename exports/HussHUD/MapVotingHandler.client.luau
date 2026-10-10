local Players=game:GetService("Players")
local ReplicatedStorage=game:GetService("ReplicatedStorage")
local TweenService=game:GetService("TweenService")
local HttpService=game:GetService("HttpService")
local player=Players.LocalPlayer
local remotes=ReplicatedStorage:WaitForChild("GameRemotes")
local frame=script.Parent:WaitForChild("MapVotingFrame")
local reopen=script.Parent:WaitForChild("ReopenMapVote")
local voting,dismissed,session=false,false,-1
local hover={}
local function resize()
 local camera=workspace.CurrentCamera
 if camera then local v=camera.ViewportSize frame.ResponsiveScale.Scale=math.min(.80,(v.X-36)/940,(v.Y-32)/530) end
end
local function selection()
 local selected=player:GetAttribute("SelectedMapVote")
 for _,card in ipairs(frame.Cards:GetChildren()) do if card:IsA("TextButton") then
  local chosen=card:GetAttribute("MapName")==selected
  card.SelectedBadge.Visible=chosen
  card.BorderStroke.Color=chosen and Color3.fromRGB(124,231,139) or (hover[card] and Color3.fromRGB(135,145,143) or Color3.fromRGB(72,77,77))
  card.BorderStroke.Thickness=chosen and 2.5 or 1.5
  card.BackgroundColor3=chosen and Color3.fromRGB(29,43,33) or Color3.fromRGB(29,32,31)
 end end
end
local function update(votes,open)
 local nextSession=remotes:GetAttribute("MapVoteSession") or 0
 if nextSession~=session then session=nextSession dismissed=true end
 voting=open==true frame.Visible=voting and not dismissed reopen.Visible=false
 for _,card in ipairs(frame.Cards:GetChildren()) do if card:IsA("TextButton") then
  local count=tonumber(votes[card:GetAttribute("MapName")]) or 0
  card.VotesLabel.Text="Tap to vote · "..tostring(count)
  card.Active=voting
 end end
 selection() resize()
end
local function sync()
 local ok,votes=pcall(HttpService.JSONDecode,HttpService,remotes:GetAttribute("MapVoteCounts") or "{}")
 update(ok and votes or {},remotes:GetAttribute("MapVoteOpen"))
end
local function timer(value)
 local seconds=math.max(0,tonumber(value) or 12)
 frame.Countdown.Text=remotes:GetAttribute("RoundState")=="Waiting" and "OPEN" or seconds.."s" reopen.Text="CHOOSE A MAP  ·  "..seconds.."s"
end
for _,card in ipairs(frame.Cards:GetChildren()) do if card:IsA("TextButton") then
 card.Activated:Connect(function() if voting then remotes.VoteMap:FireServer(card:GetAttribute("MapName")) end end)
 card.MouseEnter:Connect(function() hover[card]=true selection() end)
 card.MouseLeave:Connect(function() hover[card]=nil selection() end)
end end
frame.Close.Activated:Connect(function() dismissed=true frame.Visible=false reopen.Visible=false end)
reopen.Activated:Connect(function() dismissed=false frame.Visible=voting reopen.Visible=false end)
remotes.MapVotingUpdate.OnClientEvent:Connect(update)
remotes:GetAttributeChangedSignal("MapVoteOpen"):Connect(sync)
remotes:GetAttributeChangedSignal("MapVoteCounts"):Connect(sync)
player:GetAttributeChangedSignal("SelectedMapVote"):Connect(selection)
remotes:GetAttributeChangedSignal("MapVoteTimeLeft"):Connect(function() timer(remotes:GetAttribute("MapVoteTimeLeft")) end)
remotes.RoundStatus.OnClientEvent:Connect(function(state,left) if state=="Intermission" then timer(left) end end)
local connection
local function cameraChanged()
 if connection then connection:Disconnect() end
 if workspace.CurrentCamera then connection=workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(resize) end
 resize()
end
workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(cameraChanged)
local entrance
frame:GetPropertyChangedSignal("Visible"):Connect(function()
 if entrance then entrance:Cancel() end
 if frame.Visible then
  dismissed=false
  frame.Position=UDim2.fromScale(.5,.525)
  entrance=TweenService:Create(frame,TweenInfo.new(.22,Enum.EasingStyle.Quart,Enum.EasingDirection.Out),{Position=UDim2.fromScale(.5,.5)})
  entrance:Play()
 end
end)
cameraChanged() sync() timer(remotes:GetAttribute("MapVoteTimeLeft"))

