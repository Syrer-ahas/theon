local Screens={}
local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local UIS=game:GetService("UserInputService")
local RunService=game:GetService("RunService")
local TweenService=game:GetService("TweenService")
local BallCatalog=require(RS:WaitForChild("HussBallCatalog"))
local TitleCatalog=require(RS:WaitForChild("HussTitleCatalog"))
local AbilityCatalog=require(RS:WaitForChild("HussAbilityCatalog"))
local WHITE=Color3.fromRGB(244,245,239)
local GOLD=Color3.fromRGB(255,210,57)
local GREEN=Color3.fromRGB(31,232,55)
local RED=Color3.fromRGB(255,66,89)
local function make(class,parent,props)
 local o=Instance.new(class) for k,v in pairs(props or {}) do o[k]=v end o.Parent=parent return o
end
local function rounded(o,r)
 local c=o:FindFirstChildOfClass("UICorner") or make("UICorner",o,{}) c.CornerRadius=UDim.new(0,r or 10)
end
local function border(o,color,width) return make("UIStroke",o,{Color=color or Color3.fromRGB(4,6,6),Thickness=width or 2}) end
local function label(parent,name,value,size,pos,dims,color,weight)
 local o=make("TextLabel",parent,{Name=name,BackgroundTransparency=1,Text=value,TextSize=size,Position=pos,Size=dims,TextColor3=color or WHITE,FontFace=Font.new("rbxasset://fonts/families/Montserrat.json",weight or Enum.FontWeight.Bold)})
 border(o,Color3.new(0,0,0),1) return o
end
local function panel(parent,name,pos,size,color)
 local f=make("Frame",parent,{Name=name,Position=pos,Size=size,BackgroundColor3=color or Color3.fromRGB(20,24,24),BackgroundTransparency=.12})
 rounded(f,14) border(f)
 local inset=make("Frame",f,{Name="Inset",Position=UDim2.fromOffset(3,3),Size=UDim2.new(1,-6,1,-6),BackgroundTransparency=1})
 rounded(inset,11) border(inset,Color3.fromRGB(93,99,98),1)
 return f
end
local function button(parent,name,value,pos,size,color)
 local b=make("TextButton",parent,{Name=name,Text="",Position=pos,Size=size,BackgroundColor3=color or Color3.fromRGB(36,37,38),AutoButtonColor=false})
 rounded(b,6) border(b)
 local inset=make("Frame",b,{Position=UDim2.fromOffset(3,3),Size=UDim2.new(1,-6,1,-6),BackgroundTransparency=1})
 rounded(inset,4) border(inset,Color3.fromRGB(128,132,132),1)
 local l=label(b,"Label",value,16,UDim2.fromOffset(4,0),UDim2.new(1,-8,1,0))
 b.MouseEnter:Connect(function() b.BackgroundTransparency=.12 end) b.MouseLeave:Connect(function() b.BackgroundTransparency=0 end)
 return b,l
end
local function closeButton(parent,fn)
 local b=make("TextButton",parent,{Name="Close",Text="X",TextSize=40,FontFace=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Heavy),TextColor3=RED,BackgroundTransparency=1,Position=UDim2.new(1,-78,0,23),Size=UDim2.fromOffset(52,52)})
 border(b,Color3.new(0,0,0),2) b.Activated:Connect(fn) return b
end
local function viewport(parent,name,model,pos,size,tint)
 local v=make("ViewportFrame",parent,{Name=name,Position=pos,Size=size,BackgroundTransparency=1,Ambient=Color3.fromRGB(185,192,202),LightColor=Color3.fromRGB(255,247,229),LightDirection=Vector3.new(-1,-1,-2)})
 local world=make("WorldModel",v,{Name="Scene"})
 local clone=model:Clone() clone:PivotTo(CFrame.identity) clone.Parent=world
 local cam=make("Camera",v,{Name="PreviewCamera",FieldOfView=35})
 cam.CFrame=CFrame.lookAt(Vector3.new(3.6,2.3,6.3),Vector3.zero) v.CurrentCamera=cam
 return v,cam,clone
end
local function burst(parent,tint)
 local f=make("Frame",parent,{Name="Burst",Size=UDim2.fromScale(1,1),BackgroundColor3=tint:Lerp(Color3.fromRGB(12,19,20),.78),ClipsDescendants=true,BorderSizePixel=0}) rounded(f,11)
 make("UIGradient",f,{Color=ColorSequence.new(Color3.fromRGB(42,46,42),tint),Rotation=90})
 return f
end
function Screens.new(screen,notify)
 local self={}
 local player=Players.LocalPlayer
 local action=RS:WaitForChild("GameRemotes"):WaitForChild("HudAction")
 local old=screen:FindFirstChild("ReferenceScreens") if old then old:Destroy() end
 local root=make("Frame",screen,{Name="ReferenceScreens",Size=UDim2.fromScale(1,1),BackgroundTransparency=1,ZIndex=100})
 local main=panel(root,"Collection",UDim2.fromScale(.5,.5),UDim2.fromOffset(1136,710)) main.AnchorPoint=Vector2.new(.5,.5) main.Visible=false main.BackgroundTransparency=.06
 local scale=make("UIScale",main,{Scale=1})
 label(main,"Brand","HUSS BALLEY",27,UDim2.fromOffset(30,23),UDim2.fromOffset(250,42)).TextXAlignment=Enum.TextXAlignment.Left
 local subtitle=label(main,"Subtitle","SHOP / FIND YOUR NEXT BALL",13,UDim2.fromOffset(31,69),UDim2.fromOffset(470,26),Color3.fromRGB(114,207,255)) subtitle.TextXAlignment=Enum.TextXAlignment.Left
 local currency=label(main,"Currency","",15,UDim2.fromOffset(900,27),UDim2.fromOffset(120,56),GOLD) currency.TextXAlignment=Enum.TextXAlignment.Left currency.TextYAlignment=Enum.TextYAlignment.Top
 local divider=make("Frame",main,{Name="HeaderDivider",Position=UDim2.fromOffset(30,106),Size=UDim2.new(1,-60,0,1),BackgroundColor3=Color3.fromRGB(58,67,64),BorderSizePixel=0})
 local content=make("Frame",main,{Name="Content",Position=UDim2.fromOffset(30,122),Size=UDim2.new(1,-60,1,-150),BackgroundTransparency=1})
 local selectedAbility="Shield"
 local mode="Shop" local selected="Classic" local yaw=.5 local pitch=.25 local distance=7.5 local bigCamera
 local drag=false local lastPointer local previewHover=false
 local render
 local tabs={}
 for i,name in ipairs({"Shop","My Balls","Titles","Abilities","Rewards","Emotes"}) do
  local b=button(main,name:gsub(" ",""),name:upper(),UDim2.fromOffset(310+(i-1)*113,27),UDim2.fromOffset(106,46))
  tabs[name]=b b.Label.TextSize=15 b.Activated:Connect(function() self:Open(name) end)
 end
 function self:Close()
  main.Visible=false bigCamera=nil drag=false
  local wheel=root:FindFirstChild("EmoteWheel") if wheel then wheel:Destroy() end
  player:SetAttribute("HussHudModalOpen",false)
 end
 closeButton(main,function() self:Close() end)
 local function purchase(item) if item.Gamepass and not player:GetAttribute("OwnedBall_"..item.Id) then self:OpenBall(item.Id) else action:FireServer("Ball",item.Id) end end
 local function collection()
  local chosen=BallCatalog.ById[selected] or BallCatalog.ById.Classic
  selected=chosen.Id
  local ownedCount=0 for _,item in ipairs(BallCatalog.Items) do if player:GetAttribute("OwnedBall_"..item.Id) then ownedCount+=1 end end
  label(content,"Index","BALL INDEX",21,UDim2.fromOffset(0,0),UDim2.fromOffset(180,32)).TextXAlignment=Enum.TextXAlignment.Left
  label(content,"Owned",ownedCount.." / "..#BallCatalog.Items.." OWNED",14,UDim2.fromOffset(185,0),UDim2.fromOffset(200,32),GOLD).TextXAlignment=Enum.TextXAlignment.Left
  label(content,"CollectionHint","Your collection. Your choice.",12,UDim2.fromOffset(399,0),UDim2.fromOffset(333,32)).TextXAlignment=Enum.TextXAlignment.Right
  local grid=make("ScrollingFrame",content,{Name="BallGrid",Position=UDim2.fromOffset(0,44),Size=UDim2.fromOffset(382,312),BackgroundTransparency=1,BorderSizePixel=0,CanvasSize=UDim2.new(),AutomaticCanvasSize=Enum.AutomaticSize.Y,ScrollBarThickness=5,ScrollBarImageColor3=Color3.fromRGB(91,100,97)})
  make("UIPadding",grid,{PaddingLeft=UDim.new(0,3),PaddingTop=UDim.new(0,3),PaddingRight=UDim.new(0,8),PaddingBottom=UDim.new(0,6)})
  make("UIGridLayout",grid,{CellSize=UDim2.fromOffset(116,142),CellPadding=UDim2.fromOffset(10,10),SortOrder=Enum.SortOrder.LayoutOrder})
  for i,item in ipairs(BallCatalog.Items) do
   local owned=player:GetAttribute("OwnedBall_"..item.Id)==true local equipped=player:GetAttribute("EquippedBall")==item.Id
   local card=make("TextButton",grid,{Name="Ball_"..item.Id,Text="",LayoutOrder=i,BackgroundColor3=item.Color:Lerp(Color3.fromRGB(19,24,25),.7),AutoButtonColor=false})
   rounded(card,11) border(card,equipped and GREEN or item.Color,2)
   burst(card,item.Color)
   local outline=make("Frame",card,{Name="Outline",BackgroundTransparency=1,Size=UDim2.fromScale(1,1)})
   rounded(outline,11) border(outline,equipped and GREEN or item.Color,2)
   viewport(card,"BallModel",RS.HussBallModels[item.Id],UDim2.fromOffset(3,4),UDim2.new(1,-6,0,94))
   local title=label(card,"Name",item.Name,13,UDim2.fromOffset(6,94),UDim2.new(1,-12,0,27)) title.TextScaled=true
   make("UITextSizeConstraint",title,{MaxTextSize=13,MinTextSize=9})
   label(card,"State",equipped and "EQUIPPED" or (owned and "OWNED" or (item.Gamepass and "GAMEPASS" or "NOT OWNED")),12,UDim2.fromOffset(4,120),UDim2.new(1,-8,0,22),owned and WHITE or RED)
   if equipped then local pill=label(card,"EquippedBadge","EQUIPPED",10,UDim2.fromOffset(4,5),UDim2.fromOffset(80,20),Color3.new(0,0,0)) pill.BackgroundTransparency=0 pill.BackgroundColor3=GREEN rounded(pill,10) end
   card.Activated:Connect(function() selected=item.Id render() end)
  end
  local preview=panel(content,"SelectedPreview",UDim2.fromOffset(399,6),UDim2.fromOffset(333,156),chosen.Color)
  preview.ClipsDescendants=true burst(preview,chosen.Color)
  local outline=make("Frame",preview,{BackgroundTransparency=1,Size=UDim2.fromScale(1,1)}) rounded(outline,11) border(outline,chosen.Color,2)
  local view,cam=viewport(preview,"BallModel",RS.HussBallModels[chosen.Id],UDim2.fromOffset(6,5),UDim2.new(1,-12,1,-10))
  bigCamera=cam
  view.Active=true
  view.InputBegan:Connect(function(input) if input.UserInputType==Enum.UserInputType.MouseButton1 or input.UserInputType==Enum.UserInputType.Touch then drag=true lastPointer=Vector2.new(input.Position.X,input.Position.Y) end end)
  view.MouseEnter:Connect(function() previewHover=true end) view.MouseLeave:Connect(function() previewHover=false end)
  label(content,"DragHint","DRAG TO ROTATE · SCROLL TO ZOOM",11,UDim2.fromOffset(399,162),UDim2.fromOffset(333,22))
  label(content,"Rarity",chosen.Rarity.." ISSUE",14,UDim2.fromOffset(399,189),UDim2.fromOffset(333,24),chosen.Color).TextXAlignment=Enum.TextXAlignment.Left
  local name=label(content,"BallName",chosen.Name,29,UDim2.fromOffset(399,214),UDim2.fromOffset(333,42)) name.TextXAlignment=Enum.TextXAlignment.Left name.TextScaled=true
  make("UITextSizeConstraint",name,{MaxTextSize=24,MinTextSize=18})
  local desc=label(content,"Description",chosen.Description,14,UDim2.fromOffset(399,257),UDim2.fromOffset(333,52),WHITE,Enum.FontWeight.Medium) desc.TextWrapped=true desc.TextXAlignment=Enum.TextXAlignment.Left desc.TextYAlignment=Enum.TextYAlignment.Top
  local owned=player:GetAttribute("OwnedBall_"..chosen.Id) local equipped=player:GetAttribute("EquippedBall")==chosen.Id
  local buy=button(content,"Equip",equipped and "EQUIPPED ✓" or (owned and "EQUIP BALL" or (chosen.Gamepass and "VIEW GAMEPASS" or "BUY · "..chosen.Price.." COINS")),UDim2.fromOffset(399,318),UDim2.fromOffset(333,40),GREEN)
  buy.Activated:Connect(function() purchase(chosen) end)
 end
 local function abilities()
  local selected=AbilityCatalog.ById[selectedAbility] or AbilityCatalog.Items[1]
  local equipped=player:GetAttribute("EquippedAbility") or ""
  label(content,"Index","ABILITY INDEX",21,UDim2.fromOffset(0,0),UDim2.fromOffset(260,32)).TextXAlignment=Enum.TextXAlignment.Left
  label(content,"Count","10 AVAILABLE · EQUIP ONE",12,UDim2.fromOffset(399,0),UDim2.fromOffset(333,32),GOLD)
  local grid=make("ScrollingFrame",content,{Name="AbilityGrid",Position=UDim2.fromOffset(0,44),Size=UDim2.fromOffset(382,312),BackgroundTransparency=1,BorderSizePixel=0,CanvasSize=UDim2.new(),AutomaticCanvasSize=Enum.AutomaticSize.Y,ScrollBarThickness=5})
  make("UIPadding",grid,{PaddingLeft=UDim.new(0,3),PaddingTop=UDim.new(0,3),PaddingBottom=UDim.new(0,6)})
  make("UIGridLayout",grid,{CellSize=UDim2.fromOffset(116,104),CellPadding=UDim2.fromOffset(10,10),SortOrder=Enum.SortOrder.LayoutOrder})
  for i,item in ipairs(AbilityCatalog.Items) do
   local card=make("TextButton",grid,{Name="Ability_"..item.Id,Text="",LayoutOrder=i,BackgroundColor3=item.Color:Lerp(Color3.fromRGB(17,24,29),.78),AutoButtonColor=false})
   rounded(card,10) border(card,equipped==item.Id and GREEN or item.Color,2).ApplyStrokeMode=Enum.ApplyStrokeMode.Border
   label(card,"Icon",item.Icon,33,UDim2.fromOffset(4,4),UDim2.new(1,-8,0,43),item.Color)
   local name=label(card,"Name",item.Name,11,UDim2.fromOffset(3,49),UDim2.new(1,-6,0,28)) name.TextWrapped=true
   label(card,"Role",equipped==item.Id and "EQUIPPED" or (item.Role=="Runner" and "DODGER" or item.Role=="Thrower" and "CHASER" or "ALL ROLES"),9,UDim2.fromOffset(3,81),UDim2.new(1,-6,0,18),equipped==item.Id and GREEN or item.Color)
   card.Activated:Connect(function() selectedAbility=item.Id render() end)
  end
  local preview=panel(content,"AbilityPreview",UDim2.fromOffset(399,44),UDim2.fromOffset(333,128),selected.Color:Lerp(Color3.fromRGB(17,24,29),.8))
  label(preview,"Icon",selected.Icon,70,UDim2.new(),UDim2.fromScale(1,1),selected.Color)
  label(content,"AbilityName",selected.Name,23,UDim2.fromOffset(399,185),UDim2.fromOffset(333,33))
  local desc=label(content,"Description",selected.Description,15,UDim2.fromOffset(408,230),UDim2.fromOffset(315,65),WHITE,Enum.FontWeight.Medium) desc.TextWrapped=true
  label(content,"Cooldown","Q · "..selected.Cooldown.."s recharge",12,UDim2.fromOffset(399,290),UDim2.fromOffset(333,23),selected.Color)
  local equip=button(content,"EquipAbility",equipped==selected.Id and "UNEQUIP ABILITY" or "EQUIP ABILITY",UDim2.fromOffset(399,321),UDim2.fromOffset(333,35),equipped==selected.Id and Color3.fromRGB(83,94,86) or GREEN)
  equip.Activated:Connect(function()
   task.spawn(function()
    local ok,data=pcall(function() return RS.GameRemotes.AbilityAction:InvokeServer("Equip",equipped==selected.Id and "" or selected.Id) end)
    if not ok or not data.OK then notify("Could not equip this ability.") end
   end)
  end)
 end

 local function titles()
  local earned=0 for _,item in ipairs(TitleCatalog.Items) do if player:GetAttribute("OwnedTitle_"..item.Id) then earned+=1 end end
  label(content,"Index","TITLE COLLECTION",22,UDim2.fromOffset(0,0),UDim2.fromOffset(450,32)).TextXAlignment=Enum.TextXAlignment.Left
  label(content,"Owned",earned.." / 20 EARNED",15,UDim2.new(1,-250,0,0),UDim2.fromOffset(250,32),GOLD).TextXAlignment=Enum.TextXAlignment.Right
  local list=make("ScrollingFrame",content,{Name="TitleList",Position=UDim2.fromOffset(0,46),Size=UDim2.new(1,0,1,-46),BackgroundTransparency=1,BorderSizePixel=0,CanvasSize=UDim2.new(),AutomaticCanvasSize=Enum.AutomaticSize.Y,ScrollBarThickness=5})
  make("UIPadding",list,{PaddingLeft=UDim.new(0,3),PaddingTop=UDim.new(0,3),PaddingRight=UDim.new(0,9),PaddingBottom=UDim.new(0,6)})
  make("UIGridLayout",list,{CellSize=UDim2.new(1/3,-12,0,135),CellPadding=UDim2.fromOffset(12,12)})
  for i,item in ipairs(TitleCatalog.Items) do
   local owned=player:GetAttribute("OwnedTitle_"..item.Id) local equipped=player:GetAttribute("EquippedTitle")==item.Id
   local card=make("TextButton",list,{Name="Title_"..item.Id,Text="",LayoutOrder=equipped and 0 or (owned and i or 100+i),BackgroundColor3=Color3.fromRGB(24,28,30):Lerp(item.Color,owned and .08 or .02),AutoButtonColor=false})
   rounded(card,10) border(card,equipped and item.Color or Color3.fromRGB(85,99,102),1.5)
   label(card,"State",equipped and "EQUIPPED" or (owned and "EARNED" or "LOCKED"),10,UDim2.fromOffset(12,8),UDim2.new(1,-24,0,18),owned and item.Color or Color3.fromRGB(151,166,173)).TextXAlignment=Enum.TextXAlignment.Left
   local title=label(card,"Title",item.Name,19,UDim2.fromOffset(12,28),UDim2.new(1,-24,0,29),item.Color) title.TextScaled=true
   make("UITextSizeConstraint",title,{MaxTextSize=19,MinTextSize=11})
   local req=label(card,"Requirement",item.Description,12,UDim2.fromOffset(12,62),UDim2.new(1,-24,0,38),WHITE,Enum.FontWeight.Medium) req.TextWrapped=true req.TextXAlignment=Enum.TextXAlignment.Left req.TextYAlignment=Enum.TextYAlignment.Top
   local counts={} local ratio=0
   for _,r in ipairs(item.Requirements) do local n=math.min(r.Goal,player:GetAttribute("TitleProgress_"..r.Key) or 0) table.insert(counts,n.." / "..r.Goal) ratio+=n/r.Goal end ratio/=#item.Requirements
   label(card,"Progress",owned and "✓ TAP TO "..(equipped and "REMOVE" or "EQUIP") or table.concat(counts," · "),11,UDim2.fromOffset(12,108),UDim2.new(1,-24,0,20),owned and item.Color or Color3.fromRGB(171,189,200)).TextXAlignment=Enum.TextXAlignment.Left
   local track=make("Frame",card,{Position=UDim2.new(0,12,1,-5),Size=UDim2.new(1,-24,0,2),BackgroundColor3=Color3.fromRGB(65,77,81),BorderSizePixel=0})
   make("Frame",track,{Size=UDim2.fromScale(ratio,1),BackgroundColor3=item.Color,BorderSizePixel=0})
   card.Activated:Connect(function() if owned then action:FireServer("Title",equipped and "" or item.Id) end end)
  end
 end
 local rewardLabel,rewardButton
 local function reward()
  label(content,"Eyebrow","HUSS BALLEY / FREE REWARD",14,UDim2.fromOffset(16,8),UDim2.fromOffset(700,32),GOLD).TextXAlignment=Enum.TextXAlignment.Left
  label(content,"Heading","WELCOME REWARD",36,UDim2.fromOffset(16,54),UDim2.fromOffset(900,62)).TextXAlignment=Enum.TextXAlignment.Left
  label(content,"Instruction","PLAY FOR 10 MINUTES TO CLAIM",21,UDim2.fromOffset(16,132),UDim2.fromOffset(900,40),WHITE,Enum.FontWeight.Medium).TextXAlignment=Enum.TextXAlignment.Left
  label(content,"Amount","+200 COINS",40,UDim2.fromOffset(0,242),UDim2.new(1,0,0,60),GOLD)
  rewardLabel=label(content,"Countdown","",17,UDim2.fromOffset(0,326),UDim2.new(1,0,0,35),WHITE,Enum.FontWeight.Medium)
  rewardButton=button(content,"Claim","REWARD LOCKED",UDim2.fromOffset(50,416),UDim2.new(1,-100,0,60),Color3.fromRGB(125,125,125))
  rewardButton.Activated:Connect(function() action:FireServer("WelcomeReward") end)
 end
 local function emotes()
  self:Close()
  local wheel=panel(root,"EmoteWheel",UDim2.fromScale(.5,.5),UDim2.fromOffset(470,470)) wheel.AnchorPoint=Vector2.new(.5,.5) rounded(wheel,235) wheel.Inset:Destroy()
  local s=make("UIScale",wheel,{Scale=.85})
  for i=0,7 do local a=math.pi*2*i/8-math.pi/2
   local cell=button(wheel,"Slot"..i,"—",UDim2.fromOffset(235+math.cos(a)*155-39,235+math.sin(a)*155-39),UDim2.fromOffset(78,78))
   cell.Label.TextColor3=Color3.fromRGB(148,164,169)
  end
  label(wheel,"Title","EMOTES",15,UDim2.fromOffset(120,184),UDim2.fromOffset(230,25),GOLD)
  label(wheel,"ComingSoon","COMING SOON",25,UDim2.fromOffset(70,220),UDim2.fromOffset(330,42))
  label(wheel,"Hint","No emotes available yet",13,UDim2.fromOffset(90,265),UDim2.fromOffset(290,25),WHITE,Enum.FontWeight.Medium)
  local close=button(wheel,"CloseWheel","CLOSE  ·  G",UDim2.fromOffset(160,317),UDim2.fromOffset(150,32))
  close.Activated:Connect(function() self:Close() end)
  player:SetAttribute("HussHudModalOpen",true)
 end
 local serverData={}
 local serverBusy=false local selectedRegion="ALL" local descending=true
 local renderServers
 local function requestServers()
  if serverBusy then return end serverBusy=true
  task.spawn(function()
   local remote=RS.GameRemotes:WaitForChild("ServerBrowser",5)
   local ok,result=pcall(function() return remote:InvokeServer("List") end)
   serverBusy=false
   if ok and type(result)=="table" and result.OK~=false then serverData=result elseif main.Visible then notify(ok and type(result)=="table" and result.Message or "Server list unavailable. Try again shortly.") end
   if main.Visible and mode=="Servers" then render() end
  end)
 end
 renderServers=function()
  label(content,"Index","SERVER LIST",30,UDim2.fromOffset(0,0),UDim2.fromOffset(700,48)).TextXAlignment=Enum.TextXAlignment.Left
  label(content,"Ping","YOUR CONNECTION · "..tostring(serverData.Ping or 0).." ms",13,UDim2.fromOffset(0,53),UDim2.fromOffset(700,25),GREEN).TextXAlignment=Enum.TextXAlignment.Left
  local sort=button(content,"Sort","SORT: PLAYERS",UDim2.fromOffset(0,97),UDim2.fromOffset(220,40)) sort.Label.TextSize=13 sort.Activated:Connect(function() descending=not descending render() end)
  local refresh=button(content,"Refresh",serverBusy and "LOADING…" or "REFRESH",UDim2.new(1,-160,0,97),UDim2.fromOffset(160,40),GREEN) refresh.Activated:Connect(requestServers)
  local countries={"ALL"} local seen={ALL=true}
  for _,server in ipairs(serverData.Servers or {}) do if not seen[server.Region] then seen[server.Region]=true table.insert(countries,server.Region) end end
  local regions=make("ScrollingFrame",content,{Name="Regions",Position=UDim2.fromOffset(0,151),Size=UDim2.fromOffset(185,334),BackgroundTransparency=1,BorderSizePixel=0,AutomaticCanvasSize=Enum.AutomaticSize.Y,CanvasSize=UDim2.new(),ScrollBarThickness=3})
  make("UIListLayout",regions,{Padding=UDim.new(0,8)})
  for _,region in ipairs(countries) do local b=button(regions,region,region=="ALL" and "ALL REGIONS" or region,UDim2.new(),UDim2.fromOffset(177,42)) b.Label.TextSize=13 if selectedRegion==region then b.BackgroundColor3=Color3.fromRGB(36,83,47) end b.Activated:Connect(function() selectedRegion=region render() end) end
  local list=make("ScrollingFrame",content,{Name="Servers",Position=UDim2.fromOffset(202,151),Size=UDim2.new(1,-202,0,334),BackgroundTransparency=1,BorderSizePixel=0,AutomaticCanvasSize=Enum.AutomaticSize.Y,CanvasSize=UDim2.new(),ScrollBarThickness=5})
  make("UIListLayout",list,{Padding=UDim.new(0,10)})
  local servers=table.clone(serverData.Servers or {})
  table.sort(servers,function(a,b) if a.Here~=b.Here then return a.Here end return descending and a.Players>b.Players or (not descending and a.Players<b.Players) end)
  local rows=0
  for _,server in ipairs(servers) do if selectedRegion=="ALL" or server.Region==selectedRegion then
   rows+=1 local row=panel(list,"ServerRow"..rows,UDim2.new(),UDim2.new(1,-7,0,113),server.Here and Color3.fromRGB(28,89,41) or Color3.fromRGB(25,27,28))
   label(row,"Region",(server.Here and "YOUR SERVER · " or "")..server.Region,18,UDim2.fromOffset(16,9),UDim2.new(1,-170,0,30),server.Here and GREEN or WHITE).TextXAlignment=Enum.TextXAlignment.Left
   label(row,"Population",server.Players.." / "..server.MaxPlayers.." players · "..server.State,14,UDim2.fromOffset(16,43),UDim2.new(1,-170,0,25),WHITE,Enum.FontWeight.Medium).TextXAlignment=Enum.TextXAlignment.Left
   label(row,"Ping",(server.Ping or 0).." ms average",12,UDim2.fromOffset(16,79),UDim2.new(1,-170,0,22),GOLD).TextXAlignment=Enum.TextXAlignment.Left
   local join=button(row,"Join",server.Here and "HERE" or "JOIN",UDim2.new(1,-139,0,27),UDim2.fromOffset(121,48),server.Here and Color3.fromRGB(77,110,84) or GREEN)
   join.Activated:Connect(function() if server.Here then return end task.spawn(function() local ok,result=pcall(function() return RS.GameRemotes.ServerBrowser:InvokeServer("Join",server.Id) end) if not ok or not result.OK then notify(ok and result.Message or "Could not join this server.") end end) end)
  end end
  if rows==0 then label(list,"Empty",serverBusy and "Loading live servers…" or "No servers match this region.",17,UDim2.new(),UDim2.new(1,0,0,70)) end
  label(content,"Note","Regions reflect players' locations; ping is a server average.",12,UDim2.fromOffset(0,509),UDim2.new(1,0,0,20),WHITE,Enum.FontWeight.Medium).TextXAlignment=Enum.TextXAlignment.Left
  label(content,"Warning","Switch servers between matches.",12,UDim2.fromOffset(0,535),UDim2.new(1,0,0,20),GOLD).TextXAlignment=Enum.TextXAlignment.Left
 end
 render=function()
  bigCamera=nil rewardLabel=nil rewardButton=nil content:ClearAllChildren()
  main.Size=mode=="Update Log" and UDim2.fromOffset(600,330) or ((mode=="Shop" or mode=="My Balls" or (mode=="Titles" or mode=="Abilities")) and UDim2.fromOffset(780,500) or UDim2.fromOffset(1136,710))
  divider.Position=UDim2.fromOffset(30,mode=="Update Log" and 62 or 106)
  local collectionMode=mode=="Shop" or mode=="My Balls" or (mode=="Titles" or mode=="Abilities")
  main.Brand.Visible=collectionMode
  currency.Visible=false
  main.Brand.TextSize=19 main.Brand.Size=UDim2.fromOffset(144,42)
  for i,name in ipairs({"Shop","My Balls","Titles","Abilities","Rewards","Emotes"}) do local b=tabs[name] b.Position=UDim2.fromOffset(180+(i-1)*85,27) b.Size=UDim2.fromOffset(80,36) b.Label.TextSize=12 end
  subtitle.Position=collectionMode and UDim2.fromOffset(31,69) or UDim2.fromOffset(31,23)
  content.Position=collectionMode and UDim2.fromOffset(24,110) or UDim2.fromOffset(30,72)
  content.Size=collectionMode and UDim2.new(1,-48,1,-138) or UDim2.new(1,-60,1,-100)
  for name,b in pairs(tabs) do b.Visible=collectionMode b.BackgroundColor3=name==mode and GREEN or Color3.fromRGB(96,98,98) end
  if mode=="Shop" or mode=="My Balls" then subtitle.Text=mode=="Shop" and "SHOP / FIND YOUR NEXT BALL" or "MY BALLS / YOUR COLLECTION" collection()
  elseif mode=="Titles" then subtitle.Text="TITLES / EARN YOUR NAME" titles()
  elseif mode=="Abilities" then subtitle.Text="ABILITIES / PICK YOUR PLAYSTYLE" abilities()
  elseif mode=="Rewards" then subtitle.Text="HUSS BALLEY / FREE REWARD" reward()
  elseif mode=="Servers" then subtitle.Text="HUSS BALLEY / FIND YOUR PEOPLE" renderServers()
  elseif mode=="Update Log" then
   subtitle.Text="HUSS BALLEY / UPDATE LOG"
   label(content,"Heading","UPDATE LOG",27,UDim2.new(),UDim2.new(1,0,0,45)).TextXAlignment=Enum.TextXAlignment.Left
   local l=label(content,"Log","• Twelve custom 3D dodgeballs\n• Ball collection and rotating previews\n• Animated ball display stands\n• Earned titles and achievement progress\n• Directional slides and fast throwing\n• Prize wheel with free spins\n• Match results, XP and level progress\n• Two-map voting · Emotes coming soon",16,UDim2.fromOffset(0,59),UDim2.new(1,0,0,180),WHITE,Enum.FontWeight.Medium) l.TextXAlignment=Enum.TextXAlignment.Left l.TextYAlignment=Enum.TextYAlignment.Top l.TextWrapped=true
  end
 end
 function self:Open(name)
  local pass=screen:FindFirstChild("OpenBallPass") if pass then pass:Fire(nil) end
  local mapFrame=screen:FindFirstChild("MapVotingFrame") if mapFrame then mapFrame.Visible=false end
  if name=="Inventory" or name=="Balls" then name="My Balls" end
  if name=="Emotes" then emotes() return end
  self:Close() mode=name main.Visible=true player:SetAttribute("HussHudModalOpen",true) render()
  if mode=="Servers" then requestServers() end
 end
 function self:OpenBall(id)
  local item=BallCatalog.ById[id]
  if item and item.Gamepass then self:Close() local event=screen:WaitForChild("OpenBallPass",5) if event then event:Fire(id) end return end
  selected=item and id or "Classic" self:Open("Shop")
 end
 local refreshQueued=false
 player.AttributeChanged:Connect(function(name)
  if main.Visible and (name:find("Ball") or name:find("Title") or name=="EquippedAbility" or name=="WelcomeRewardClaimed") and not refreshQueued then
   refreshQueued=true task.delay(.06,function() refreshQueued=false if main.Visible then render() end end)
  end
 end)
 UIS.InputChanged:Connect(function(input)
  if drag and (input.UserInputType==Enum.UserInputType.MouseMovement or input.UserInputType==Enum.UserInputType.Touch) then
   local p=Vector2.new(input.Position.X,input.Position.Y) if lastPointer then local delta=p-lastPointer yaw-=delta.X*.008 pitch=math.clamp(pitch+delta.Y*.006,-1.1,1.1) end lastPointer=p
  elseif main.Visible and previewHover and input.UserInputType==Enum.UserInputType.MouseWheel then distance=math.clamp(distance-input.Position.Z*.5,4.5,12) end
 end)
 UIS.InputEnded:Connect(function(input) if input.UserInputType==Enum.UserInputType.MouseButton1 or input.UserInputType==Enum.UserInputType.Touch then drag=false end end)
 UIS.InputBegan:Connect(function(input,processed) if UIS:GetFocusedTextBox() then return end if input.KeyCode==Enum.KeyCode.X or input.KeyCode==Enum.KeyCode.Escape then self:Close() end end)
 RunService.RenderStepped:Connect(function(dt)
  local camera=workspace.CurrentCamera if camera then scale.Scale=math.min((mode=="Update Log" or mode=="Shop" or mode=="My Balls" or (mode=="Titles" or mode=="Abilities")) and 1 or .68,(camera.ViewportSize.X-48)/main.Size.X.Offset,(camera.ViewportSize.Y-48)/main.Size.Y.Offset) end
  if bigCamera then if not drag then yaw+=dt*.16 end bigCamera.CFrame=CFrame.lookAt(Vector3.new(math.sin(yaw)*math.cos(pitch),math.sin(pitch),math.cos(yaw)*math.cos(pitch))*distance,Vector3.zero) end
  if main.Visible then
   local stats=player:FindFirstChild("leaderstats") local coins=stats and stats:FindFirstChild("Coins") local gems=stats and stats:FindFirstChild("Gems")
   currency.Text="● "..(coins and coins.Value or 0).."\n◆ "..(gems and gems.Value or 0)
   if rewardLabel and rewardButton then
    local remaining=math.max(0,(player:GetAttribute("RewardReadyAt") or math.huge)-workspace:GetServerTimeNow())
    local claimed=player:GetAttribute("WelcomeRewardClaimed")
    rewardLabel.Text=claimed and "Reward collected. Enjoy your next ball!" or (remaining>0 and string.format("%d:%02d until this can be claimed",math.floor(remaining/60),remaining%60) or "Your reward is ready.")
    rewardButton.Label.Text=claimed and "REWARD CLAIMED ✓" or (remaining>0 and "REWARD LOCKED" or "CLAIM +200 COINS")
    rewardButton.BackgroundColor3=(claimed or remaining>0) and Color3.fromRGB(135,137,138) or GREEN
    if claimed then rewardButton.BackgroundColor3=Color3.fromRGB(135,137,138) end
   end
  end
 end)
 self.Root=root
 task.spawn(function() require(RS:WaitForChild("HussLobbyDisplays")).Start(self) end)
 return self
end
return Screens
