local Players=game:GetService("Players")
local RS=game:GetService("ReplicatedStorage")
local Run=game:GetService("RunService")
local CAS=game:GetService("ContextActionService")
local UIS=game:GetService("UserInputService")
local p=Players.LocalPlayer
local screen=p.PlayerGui:WaitForChild("HussGameGui")
local catalog=require(RS:WaitForChild("HussAbilityCatalog"))
local remote=RS.GameRemotes:WaitForChild("AbilityAction")
local font=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Bold)
local function make(class,parent,props) local o=Instance.new(class) for k,v in pairs(props) do o[k]=v end o.Parent=parent return o end
local card=make("TextButton",screen,{Name="EquippedAbilityCard",Text="",AnchorPoint=Vector2.new(.5,1),Position=UDim2.new(.5,0,1,-84),Size=UDim2.fromOffset(276,76),BackgroundColor3=Color3.fromRGB(22,30,34),BackgroundTransparency=.12,Visible=false})
make("UICorner",card,{CornerRadius=UDim.new(0,11)})
local border=make("UIStroke",card,{Color=Color3.fromRGB(103,184,207),Thickness=2,ApplyStrokeMode=Enum.ApplyStrokeMode.Border})
local scale=make("UIScale",card,{Scale=1})
local function label(name,text,size,pos,dims,color)
 return make("TextLabel",card,{Name=name,Text=text,TextSize=size,FontFace=font,TextColor3=color or Color3.new(1,1,1),BackgroundTransparency=1,Position=pos,Size=dims,TextXAlignment=Enum.TextXAlignment.Left})
end
local icon=label("Icon","S",32,UDim2.fromOffset(12,18),UDim2.fromOffset(42,38))
label("Category","ABILITY",9,UDim2.fromOffset(12,5),UDim2.fromOffset(100,14),Color3.fromRGB(190,204,210))
local name=label("AbilityName","",14,UDim2.fromOffset(65,15),UDim2.fromOffset(199,23))
local status=label("Status","",10,UDim2.fromOffset(65,40),UDim2.fromOffset(199,17),Color3.fromRGB(152,220,244))
local track=make("Frame",card,{Name="Track",Position=UDim2.fromOffset(12,65),Size=UDim2.fromOffset(252,3),BackgroundColor3=Color3.fromRGB(63,76,83),BorderSizePixel=0})
local fill=make("Frame",track,{Name="Fill",Size=UDim2.fromScale(1,1),BackgroundColor3=Color3.fromRGB(103,184,207),BorderSizePixel=0})
local busy=false
local function use()
 if busy or UIS:GetFocusedTextBox() or p:GetAttribute("HussHudModalOpen") then return end
 busy=true task.spawn(function() pcall(function() remote:InvokeServer("Use") end) busy=false end)
end
card.Activated:Connect(use)
CAS:BindAction("HussAbility",function(_,state) if state==Enum.UserInputState.Begin then use() end return Enum.ContextActionResult.Pass end,false,Enum.KeyCode.Q,Enum.KeyCode.ButtonY)
Run.RenderStepped:Connect(function()
 local item=catalog.ById[p:GetAttribute("EquippedAbility")]
 card.Visible=item~=nil and p:GetAttribute("HussHudModalOpen")~=true
 if not item then return end
 name.Text=item.Name icon.Text=item.Icon icon.TextColor3=item.Color border.Color=item.Color fill.BackgroundColor3=item.Color
 local now=workspace:GetServerTimeNow() local left=math.max(0,(p:GetAttribute("AbilityReadyAt") or 0)-now)
 local active=math.max(0,(p:GetAttribute("AbilityActiveUntil") or 0)-now)
 local role=p:GetAttribute("PlayerRole")
 local valid=RS.GameRemotes:GetAttribute("RoundState")=="Active" and (role=="Runner" or role=="Thrower")
 local matches=item.Role=="Both" or item.Role==role
 status.Text=not valid and "EQUIPPED · WAIT FOR MATCH" or not matches and (item.Role=="Runner" and "DODGER ABILITY" or "CHASER ABILITY") or active>0 and string.format("ACTIVE · %.1fs",active) or left>0 and string.format("RECHARGING · %.1fs",left) or "Q · READY"
 fill.Size=UDim2.fromScale(math.clamp(1-left/item.Cooldown,0,1),1)
 local camera=workspace.CurrentCamera if camera then scale.Scale=math.min(1,camera.ViewportSize.X/600,camera.ViewportSize.Y/500) end
end)
