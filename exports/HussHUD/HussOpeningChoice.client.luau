local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local Run=game:GetService("RunService")
local Http=game:GetService("HttpService")
local p=Players.LocalPlayer
local remotes=RS:WaitForChild("GameRemotes")
local remote=remotes:WaitForChild("OpeningChoice")
local font=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Heavy)
local WHITE=Color3.fromRGB(245,249,250)
local GREEN=Color3.fromRGB(34,224,56)
local GOLD=Color3.fromRGB(255,200,52)
local function make(class,parent,props)
 local o=Instance.new(class) for k,v in pairs(props) do o[k]=v end o.Parent=parent return o
end
local gui=make("ScreenGui",p:WaitForChild("PlayerGui"),{Name="HussOpeningChoice",ResetOnSpawn=false,DisplayOrder=25})
local card=make("Frame",gui,{Name="ChoiceCard",AnchorPoint=Vector2.new(.5,0),Position=UDim2.new(.5,0,0,116),Size=UDim2.fromOffset(440,110),BackgroundColor3=Color3.fromRGB(19,27,29),BackgroundTransparency=.16,Visible=false})
make("UICorner",card,{CornerRadius=UDim.new(0,10)})
make("UIStroke",card,{Color=Color3.fromRGB(0,0,0),Thickness=2})
local scale=make("UIScale",card,{})
local function text(parent,name,value,size,pos,dim,color)
 return make("TextLabel",parent,{Name=name,Text=value,FontFace=font,TextSize=size,TextColor3=color or WHITE,TextStrokeTransparency=.2,TextStrokeColor3=Color3.new(),BackgroundTransparency=1,Position=pos,Size=dim})
end
local title=text(card,"Title","CHOOSE A PLAYER",18,UDim2.fromOffset(14,9),UDim2.fromOffset(370,27))
title.TextXAlignment=Enum.TextXAlignment.Left
local timer=text(card,"Timer","12s",13,UDim2.new(1,-58,0,12),UDim2.fromOffset(44,20),GOLD)
local function button(parent,name,value,pos,size,color)
 local b=make("TextButton",parent,{Name=name,Text=value,FontFace=font,TextSize=17,TextColor3=WHITE,TextStrokeTransparency=.1,Position=pos,Size=size,BackgroundColor3=color or Color3.fromRGB(47,57,59),AutoButtonColor=true})
 make("UICorner",b,{CornerRadius=UDim.new(0,7)})
 make("UIStroke",b,{Color=Color3.fromRGB(0,0,0),Thickness=2,ApplyStrokeMode=Enum.ApplyStrokeMode.Border})
 return b
end
local dropdown=button(card,"PlayerDropdown","Choose a player  v",UDim2.fromOffset(14,46),UDim2.fromOffset(412,44))
local list=make("ScrollingFrame",card,{Name="MatchPlayers",Position=UDim2.fromOffset(14,96),Size=UDim2.fromOffset(412,216),BackgroundColor3=Color3.fromRGB(23,31,33),BackgroundTransparency=.04,BorderSizePixel=0,ScrollBarThickness=4,AutomaticCanvasSize=Enum.AutomaticSize.Y,CanvasSize=UDim2.new(),Visible=false,ZIndex=3})
make("UICorner",list,{CornerRadius=UDim.new(0,7)})
make("UIStroke",list,{Color=Color3.new(),Thickness=2})
make("UIPadding",list,{PaddingTop=UDim.new(0,6),PaddingBottom=UDim.new(0,6),PaddingLeft=UDim.new(0,6),PaddingRight=UDim.new(0,6)})
make("UIListLayout",list,{Padding=UDim.new(0,5),SortOrder=Enum.SortOrder.LayoutOrder})
local hero=button(card,"Hero","HERO",UDim2.fromOffset(14,46),UDim2.fromOffset(202,44),GREEN)
local chicken=button(card,"Chicken","CHICKEN",UDim2.fromOffset(224,46),UDim2.fromOffset(202,44),Color3.fromRGB(233,91,55))
local hint=text(card,"Hint","",11,UDim2.fromOffset(14,96),UDim2.fromOffset(412,24))
local thumbnails={}
local function portrait(row,entry)
 local holder=make("Frame",row,{Name="Portrait",Position=UDim2.fromOffset(7,5),Size=UDim2.fromOffset(40,40),BackgroundColor3=Color3.fromRGB(67,81,85),BorderSizePixel=0,ZIndex=5,ClipsDescendants=true})
 make("UICorner",holder,{CornerRadius=UDim.new(1,0)})
 local initials=text(holder,"Fallback",entry.DisplayName:sub(1,1):upper(),20,UDim2.new(),UDim2.fromScale(1,1))
 initials.ZIndex=6
 local img=make("ImageLabel",holder,{Name="Headshot",Size=UDim2.fromScale(1,1),BackgroundTransparency=1,ZIndex=7,Visible=false,ScaleType=Enum.ScaleType.Crop})
 make("UICorner",img,{CornerRadius=UDim.new(1,0)})
 local function apply(url)
  if not holder.Parent then return end
  img.Image=url img.Visible=true initials.Visible=false
 end
 if thumbnails[entry.UserId] then apply(thumbnails[entry.UserId]) return end
 if entry.UserId<=0 then
  -- Local Studio players have no Roblox account thumbnail; preview their test head.
  local testPlayer=Players:GetPlayerByUserId(entry.UserId)
  local head=testPlayer and testPlayer.Character and testPlayer.Character:FindFirstChild("Head")
  if head then
   local view=make("ViewportFrame",holder,{Name="StudioHeadshot",Size=UDim2.fromScale(1,1),BackgroundTransparency=1,ZIndex=7,Ambient=Color3.fromRGB(210,210,210),LightColor=Color3.fromRGB(255,255,255),LightDirection=Vector3.new(-1,-1,-2)})
   local model=make("WorldModel",view,{})
   local clone=head:Clone()
   for _,obj in clone:GetDescendants() do
    if obj:IsA("JointInstance") or obj:IsA("Constraint") or obj:IsA("BaseScript") or obj:IsA("BillboardGui") then obj:Destroy()
    elseif obj:IsA("SpecialMesh") then obj.TextureId="" obj.VertexColor=Vector3.one end
   end
   clone.Anchored=true clone.CanCollide=false clone.CFrame=CFrame.identity
   if clone.Color.R+clone.Color.G+clone.Color.B<.15 then clone.Color=Color3.fromRGB(208,186,155) end
   clone.Parent=model
   local camera=make("Camera",view,{FieldOfView=35,CFrame=CFrame.lookAt(Vector3.new(0,.08,-4.3),Vector3.zero)})
   view.CurrentCamera=camera initials.Visible=false
  end
  return
 end
 task.spawn(function()
  for attempt=1,3 do
   if not holder.Parent then return end
   local ok,url,ready=pcall(function()
    return Players:GetUserThumbnailAsync(entry.UserId,Enum.ThumbnailType.HeadShot,Enum.ThumbnailSize.Size100x100)
   end)
   if ok and ready and url~="" then thumbnails[entry.UserId]=url apply(url) return end
   task.wait(attempt*.5)
  end
 end)
end
local open=false
local function send(kind,value)
 remote:FireServer(kind,value,remotes:GetAttribute("OpeningSession"))
end
dropdown.Activated:Connect(function() open=not open list.Visible=open end)
hero.Activated:Connect(function() send("Choice","Hero") end)
chicken.Activated:Connect(function() send("Choice","Chicken") end)
local function selectedName()
 local id=remotes:GetAttribute("OpeningSelected")
 for _,player in Players:GetPlayers() do if player.UserId==id then return player.DisplayName end end
 return "The selected dodger"
end
local function render()
 local phase=remotes:GetAttribute("OpeningPhase")
 local role=p:GetAttribute("PlayerRole")
 card.Visible=(phase=="Pick" or phase=="Decision") and (role=="Runner" or role=="Thrower")
 hero.Visible=false chicken.Visible=false dropdown.Visible=false hint.Visible=false list.Visible=false
 if not card.Visible then open=false return end
 card.Size=UDim2.fromOffset(440,110)
 if phase=="Pick" then
  title.TextSize=18
  title.Text=p.UserId==remotes:GetAttribute("OpeningLead") and "CHOOSE A PLAYER" or "CHASER IS CHOOSING…"
  dropdown.Visible=p.UserId==remotes:GetAttribute("OpeningLead")
  if not dropdown.Visible then hint.Visible=true hint.Position=UDim2.fromOffset(14,48) hint.Text="Wait for the first chaser to choose a dodger." end
  for _,child in list:GetChildren() do if child:IsA("TextButton") then child:Destroy() end end
  local ok,candidates=pcall(Http.JSONDecode,Http,remotes:GetAttribute("OpeningCandidates") or "[]")
  if ok then
   list.Size=UDim2.fromOffset(412,math.clamp(#candidates*55+12,67,232))
   for index,entry in ipairs(candidates) do
    local row=button(list,"Player_"..entry.UserId,"",UDim2.new(),UDim2.new(1,-12,0,50))
    row.LayoutOrder=index row.TextSize=13 row.ZIndex=4
    portrait(row,entry)
    local name=text(row,"DisplayName",entry.DisplayName,14,UDim2.fromOffset(57,5),UDim2.new(1,-69,0,22))
    name.ZIndex=5 name.TextXAlignment=Enum.TextXAlignment.Left name.TextTruncate=Enum.TextTruncate.AtEnd
    local username=text(row,"Username","@"..entry.Name,11,UDim2.fromOffset(57,28),UDim2.new(1,-69,0,17),Color3.fromRGB(182,201,207))
    username.ZIndex=5 username.TextXAlignment=Enum.TextXAlignment.Left username.TextTruncate=Enum.TextTruncate.AtEnd
    row.Activated:Connect(function() open=false list.Visible=false send("Pick",entry.UserId) end)
   end
  end
  list.Visible=dropdown.Visible and open
 else
  local chosen=p.UserId==remotes:GetAttribute("OpeningSelected")
  title.Text=chosen and "HERO OR CHICKEN?" or selectedName().." IS CHOOSING…"
  title.TextSize=chosen and 18 or 14
  hero.Visible=chosen chicken.Visible=chosen
  hint.Visible=true
  hint.Position=UDim2.fromOffset(14,chosen and 95 or 48)
  hint.Text=chosen and (remotes:GetAttribute("OpeningChoiceHint") or "") or "The selected dodger decides how the crossing begins."
  if chosen then card.Size=UDim2.fromOffset(440,127) end
 end
end
for _,attr in ipairs({"OpeningPhase","OpeningSelected","OpeningLead","OpeningCandidates","OpeningSession","OpeningChoiceHint"}) do remotes:GetAttributeChangedSignal(attr):Connect(render) end
p:GetAttributeChangedSignal("PlayerRole"):Connect(render)
Run.RenderStepped:Connect(function()
 if not card.Visible then return end
 timer.Text=math.max(0,math.ceil((remotes:GetAttribute("OpeningDeadline") or 0)-workspace:GetServerTimeNow())).."s"
 local camera=workspace.CurrentCamera
 if camera then scale.Scale=math.min(1,camera.ViewportSize.X/650,camera.ViewportSize.Y/540) end
end)
render()
