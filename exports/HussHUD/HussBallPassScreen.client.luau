
local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local Market=game:GetService("MarketplaceService")
local Run=game:GetService("RunService")
local UIS=game:GetService("UserInputService")
local player=Players.LocalPlayer
local screen=player.PlayerGui:WaitForChild("HussGameGui")
local catalog=require(RS:WaitForChild("HussBallCatalog"))
local remotes=RS.GameRemotes
local event=Instance.new("BindableEvent") event.Name="OpenBallPass" event.Parent=screen
local font=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Bold)
local function make(class,parent,props) local o=Instance.new(class) for k,v in pairs(props) do o[k]=v end o.Parent=parent return o end
local function round(o) make("UICorner",o,{CornerRadius=UDim.new(0,10)}) end
local function stroke(o,color,width) make("UIStroke",o,{Color=color or Color3.fromRGB(65,85,95),Thickness=width or 1.5,ApplyStrokeMode=Enum.ApplyStrokeMode.Border}) end
local function label(parent,name,value,size,pos,dims,color)
 return make("TextLabel",parent,{Name=name,Text=value,TextSize=size,FontFace=font,TextColor3=color or Color3.fromRGB(245,247,240),BackgroundTransparency=1,Position=pos,Size=dims,TextXAlignment=Enum.TextXAlignment.Left})
end
local root=make("Frame",screen,{Name="BallPassScreen",Size=UDim2.fromScale(1,1),BackgroundTransparency=1,ZIndex=350})
local window=make("Frame",root,{Name="Window",Size=UDim2.fromOffset(700,420),Position=UDim2.fromScale(.5,.5),AnchorPoint=Vector2.new(.5,.5),BackgroundColor3=Color3.fromRGB(19,27,31),BackgroundTransparency=.1,Visible=false}) round(window) stroke(window)
local scale=make("UIScale",window,{})
local title=label(window,"Title","BALL GAMEPASS",25,UDim2.fromOffset(24,20),UDim2.fromOffset(570,34))
label(window,"Category","GAMEPASS / BALL COLLECTION",11,UDim2.fromOffset(25,58),UDim2.fromOffset(580,21),Color3.fromRGB(148,204,229))
local close=make("TextButton",window,{Name="Close",Text="×",TextSize=32,FontFace=font,TextColor3=Color3.fromRGB(255,83,97),BackgroundTransparency=1,Position=UDim2.fromOffset(646,13),Size=UDim2.fromOffset(40,40)})
local preview=make("ViewportFrame",window,{Name="Preview",Position=UDim2.fromOffset(24,97),Size=UDim2.fromOffset(284,247),BackgroundColor3=Color3.fromRGB(30,39,43),Ambient=Color3.fromRGB(185,196,201),LightColor=Color3.fromRGB(248,244,231),LightDirection=Vector3.new(-1,-1,-2)}) round(preview)
local world=make("WorldModel",preview,{})
local camera=make("Camera",preview,{FieldOfView=38}) preview.CurrentCamera=camera
local description=label(window,"Description","",17,UDim2.fromOffset(334,106),UDim2.fromOffset(339,94)) description.TextWrapped=true description.TextYAlignment=Enum.TextYAlignment.Top
label(window,"Fairness","Cosmetic only. Same ball speed and hitbox.",13,UDim2.fromOffset(334,206),UDim2.fromOffset(339,48),Color3.fromRGB(158,193,202)).TextWrapped=true
local status=label(window,"Status","",14,UDim2.fromOffset(334,266),UDim2.fromOffset(339,36),Color3.fromRGB(248,204,101)) status.TextWrapped=true
local buy=make("TextButton",window,{Name="Buy",Text="LOADING…",TextSize=17,FontFace=font,TextColor3=Color3.fromRGB(245,247,240),BackgroundColor3=Color3.fromRGB(73,59,99),Position=UDim2.fromOffset(334,315),Size=UDim2.fromOffset(339,44)}) round(buy) stroke(buy,Color3.fromRGB(132,112,174))
label(window,"Hint","3D BALL PREVIEW",11,UDim2.fromOffset(24,349),UDim2.fromOffset(284,22),Color3.fromRGB(154,176,183)).TextXAlignment=Enum.TextXAlignment.Center
label(window,"Note","Owned gamepasses unlock their ball every time you join.",12,UDim2.fromOffset(24,382),UDim2.fromOffset(649,20),Color3.fromRGB(151,173,180))
local selected local info local token=0 local rotation=0
local function closeWindow() window.Visible=false player:SetAttribute("HussHudModalOpen",false) end
close.Activated:Connect(closeWindow)
local function update()
 if not selected then return end
 local owned=player:GetAttribute("OwnedBall_"..selected)==true or info and info.Owned
 if owned then
  local equipped=player:GetAttribute("EquippedBall")==selected
  buy.Text=equipped and "EQUIPPED ✓" or "OWNED · EQUIP BALL" buy.BackgroundColor3=Color3.fromRGB(35,143,69) status.Text="In your collection."
 elseif info and info.Configured and info.ForSale and info.Price then buy.Text="BUY · "..info.Price.." ROBUX" status.Text="One-time gamepass purchase."
 elseif info then buy.Text="COMING SOON" status.Text="This gamepass is not available yet."
 else buy.Text="LOADING…" status.Text="Checking availability…" end
end
local function open(id)
 if not id then closeWindow() return end
 local item=catalog.ById[id] if not item or not item.Gamepass then return end
 token+=1 local request=token selected=id info=nil world:ClearAllChildren()
 local model=RS.HussBallModels[id]:Clone() model:PivotTo(CFrame.identity) model.Parent=world
 title.Text=item.Name description.Text=item.Description
 local reference=screen:FindFirstChild("ReferenceScreens") if reference then local c=reference:FindFirstChild("Collection") if c then c.Visible=false end local e=reference:FindFirstChild("EmoteWheel") if e then e:Destroy() end end
 local map=screen:FindFirstChild("MapVotingFrame") if map then map.Visible=false end
 window.Visible=true player:SetAttribute("HussHudModalOpen",true) update()
 task.spawn(function()
  local ok,result=pcall(function() return remotes:WaitForChild("BallGamepass"):InvokeServer("Info",id) end)
  if request~=token then return end
  info=ok and type(result)=="table" and result.OK and result or {Configured=false}
  update()
 end)
end
event.Event:Connect(open)
buy.Activated:Connect(function()
 if not selected then return end
 if player:GetAttribute("OwnedBall_"..selected)==true or info and info.Owned then remotes.HudAction:FireServer("Ball",selected)
 elseif info and info.Configured and info.ForSale and info.Price then Market:PromptGamePassPurchase(player,info.Id)
 else status.Text="This gamepass is coming soon." end
end)
player.AttributeChanged:Connect(function(key) if selected and (key=="OwnedBall_"..selected or key=="EquippedBall") then update() end end)
Market.PromptGamePassPurchaseFinished:Connect(function(p,id,bought)
 if p~=player or not bought or not info or info.Id~=id then return end
 task.delay(.5,function() if selected then local ok,result=pcall(function() return remotes.BallGamepass:InvokeServer("Refresh",selected) end) if ok and result.OK then info=result update() end end end)
end)
UIS.InputBegan:Connect(function(input,processed) if not processed and (input.KeyCode==Enum.KeyCode.Escape or input.KeyCode==Enum.KeyCode.X) and window.Visible then closeWindow() end end)
Run.RenderStepped:Connect(function(dt)
 rotation+=dt*.18
 camera.CFrame=CFrame.lookAt(Vector3.new(math.sin(rotation)*6.2,.65,math.cos(rotation)*6.2),Vector3.zero)
 local main=workspace.CurrentCamera if main then scale.Scale=math.min(1,(main.ViewportSize.X-28)/700,(main.ViewportSize.Y-28)/420) end
end)

