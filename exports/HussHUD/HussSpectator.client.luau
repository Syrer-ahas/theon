local Players=game:GetService("Players")
local UIS=game:GetService("UserInputService")
local RunService=game:GetService("RunService")
local RS=game:GetService("ReplicatedStorage")
local player=Players.LocalPlayer
local screen=player:WaitForChild("PlayerGui"):WaitForChild("HussGameGui")
local toggle=Instance.new("BindableEvent") toggle.Name="ToggleSpectate" toggle.Parent=screen
local active=false local free=false local index=1 local targets={} local controls
local function getControls()
 if controls then return controls end
 local module=player.PlayerScripts:FindFirstChild("PlayerModule")
 if module then local ok,result=pcall(function() return require(module):GetControls() end) if ok then controls=result end end
 return controls
end
local function text(parent,value,size,pos,dims,color)
 local o=Instance.new("TextLabel") o.BackgroundTransparency=1 o.Text=value o.TextSize=size o.Position=pos o.Size=dims o.TextColor3=color or Color3.fromRGB(245,245,240) o.FontFace=Font.new("rbxasset://fonts/families/Montserrat.json",Enum.FontWeight.Bold) o.Parent=parent
 local s=Instance.new("UIStroke") s.Color=Color3.new(0,0,0) s.Thickness=1 s.Parent=o return o
end
local function rounded(o,r) local c=Instance.new("UICorner") c.CornerRadius=UDim.new(0,r) c.Parent=o end
local function panel(parent,pos,size)
 local f=Instance.new("Frame") f.BackgroundColor3=Color3.fromRGB(24,33,29) f.BackgroundTransparency=.1 f.Position=pos f.Size=size f.Parent=parent rounded(f,13)
 local s=Instance.new("UIStroke") s.Color=Color3.new(0,0,0) s.Thickness=3 s.Parent=f return f
end
local function button(parent,value,pos,size,color)
 local b=Instance.new("TextButton") b.Text="" b.Position=pos b.Size=size b.BackgroundColor3=color or Color3.fromRGB(135,138,138) b.Parent=parent rounded(b,7)
 local s=Instance.new("UIStroke") s.Color=Color3.new(0,0,0) s.Thickness=2 s.Parent=b text(b,value,16,UDim2.new(),UDim2.fromScale(1,1)) return b
end
local root=Instance.new("Frame") root.Name="SpectatorHUD" root.BackgroundTransparency=1 root.Size=UDim2.fromScale(1,1) root.Visible=false root.ZIndex=200 root.Parent=screen
local bar=panel(root,UDim2.new(.5,0,1,-12),UDim2.fromOffset(780,102)) bar.AnchorPoint=Vector2.new(.5,1)
local scale=Instance.new("UIScale") scale.Parent=bar
local hint=panel(root,UDim2.new(.5,0,1,-128),UDim2.fromOffset(664,26)) hint.AnchorPoint=Vector2.new(.5,1)
local hintScale=Instance.new("UIScale") hintScale.Parent=hint
local hintText=text(hint,"Right-drag: orbit · Scroll: zoom · X: exit",11,UDim2.new(),UDim2.fromScale(1,1))
local watching=text(bar,"WATCHING / 1 OF 1",11,UDim2.fromOffset(20,9),UDim2.fromOffset(360,20),Color3.fromRGB(125,217,255)) watching.TextXAlignment=Enum.TextXAlignment.Left
local name=text(bar,"",20,UDim2.fromOffset(20,32),UDim2.fromOffset(500,31)) name.TextXAlignment=Enum.TextXAlignment.Left name.TextTruncate=Enum.TextTruncate.AtEnd
local role=text(bar,"",12,UDim2.fromOffset(20,72),UDim2.fromOffset(190,20)) role.TextXAlignment=Enum.TextXAlignment.Left
local previous=button(bar,"‹",UDim2.fromOffset(206,55),UDim2.fromOffset(44,38))
local next=button(bar,"›",UDim2.fromOffset(256,55),UDim2.fromOffset(44,38))
local follow=button(bar,"FOLLOW",UDim2.fromOffset(317,55),UDim2.fromOffset(104,38),Color3.fromRGB(29,230,58))
local freeButton=button(bar,"FREE CAM",UDim2.fromOffset(429,55),UDim2.fromOffset(116,38))
local exit=button(bar,"EXIT SPECTATE  ×",UDim2.fromOffset(562,19),UDim2.fromOffset(196,69),Color3.fromRGB(240,51,58))
local help=button(bar,"?",UDim2.fromOffset(513,11),UDim2.fromOffset(31,29),Color3.fromRGB(36,37,38))
local freeCF=CFrame.identity local pitch=0 local yaw=0 local rightHeld=false
local function list()
 targets={}
 for _,p in ipairs(Players:GetPlayers()) do local hum=p.Character and p.Character:FindFirstChildOfClass("Humanoid") if hum and hum.Health>0 then table.insert(targets,p) end end
 table.sort(targets,function(a,b)return a.UserId<b.UserId end)
 index=math.clamp(index,1,math.max(1,#targets))
end
local function stop()
 active=false free=false rightHeld=false root.Visible=false
 local hud=screen:FindFirstChild("ReferenceHUD") if hud and hud:FindFirstChild("Bottom") then hud.Bottom.Visible=true end
 UIS.MouseBehavior=Enum.MouseBehavior.Default
 local c=getControls() if c then c:Enable() end
 local camera=workspace.CurrentCamera
 if camera then camera.CameraType=Enum.CameraType.Custom camera.CameraSubject=player.Character and player.Character:FindFirstChildOfClass("Humanoid") end
end
local function applyTarget()
 list() local target=targets[index]
 if not target then stop() return end
 local camera=workspace.CurrentCamera
 if not free and camera then camera.CameraType=Enum.CameraType.Custom camera.CameraSubject=target.Character:FindFirstChildOfClass("Humanoid") end
 watching.Text="WATCHING / "..index.." OF "..#targets name.Text=target.DisplayName
 role.Text=(target:GetAttribute("PlayerRole") or "Lobby").." · "..(RS.GameRemotes:GetAttribute("RoundState")=="Active" and "Active" or "Lobby")
end
local function begin()
 local role=player:GetAttribute("PlayerRole")
 if RS.GameRemotes:GetAttribute("RoundState")=="Active" and role~="Lobby" then return end
 active=true free=false root.Visible=true
 local hud=screen:FindFirstChild("ReferenceHUD") if hud and hud:FindFirstChild("Bottom") then hud.Bottom.Visible=false end
 local c=getControls() if c then c:Disable() end applyTarget()
end
toggle.Event:Connect(function() if active then stop() else begin() end end)
previous.Activated:Connect(function() index-=1 if index<1 then index=#targets end applyTarget() end)
next.Activated:Connect(function() index=index%math.max(1,#targets)+1 applyTarget() end)
follow.Activated:Connect(function() free=false UIS.MouseBehavior=Enum.MouseBehavior.Default follow.BackgroundColor3=Color3.fromRGB(29,230,58) freeButton.BackgroundColor3=Color3.fromRGB(135,138,138) hintText.Text="Right-drag: orbit · Scroll: zoom · X: exit" applyTarget() end)
freeButton.Activated:Connect(function()
 free=true local camera=workspace.CurrentCamera if not camera then return end
 freeCF=camera.CFrame local direction=freeCF.LookVector pitch=math.asin(direction.Y) yaw=math.atan2(-direction.X,-direction.Z)
 camera.CameraType=Enum.CameraType.Scriptable
 freeButton.BackgroundColor3=Color3.fromRGB(29,230,58) follow.BackgroundColor3=Color3.fromRGB(135,138,138)
 hintText.Text="WASD: move · Q/E: down/up · Right-drag: look · X: exit"
end)
exit.Activated:Connect(stop) help.Activated:Connect(function() hint.Visible=not hint.Visible end)
UIS.InputBegan:Connect(function(input)
 if active and input.KeyCode==Enum.KeyCode.X then stop() end
 if active and free and input.UserInputType==Enum.UserInputType.MouseButton2 then rightHeld=true UIS.MouseBehavior=Enum.MouseBehavior.LockCurrentPosition end
end)
UIS.InputEnded:Connect(function(input) if input.UserInputType==Enum.UserInputType.MouseButton2 then rightHeld=false if active then UIS.MouseBehavior=Enum.MouseBehavior.Default end end end)
UIS.InputChanged:Connect(function(input) if active and free and rightHeld and input.UserInputType==Enum.UserInputType.MouseMovement then yaw-=input.Delta.X*.003 pitch=math.clamp(pitch-input.Delta.Y*.003,-1.5,1.5) end end)
player.CharacterAdded:Connect(stop)
player:GetAttributeChangedSignal("PlayerRole"):Connect(function() if active and player:GetAttribute("PlayerRole")~="Lobby" and RS.GameRemotes:GetAttribute("RoundState")=="Active" then stop() end end)
Players.PlayerRemoving:Connect(function() if active then task.defer(applyTarget) end end)
RunService.RenderStepped:Connect(function(dt)
 local camera=workspace.CurrentCamera
 if camera then local s=math.min(.88,(camera.ViewportSize.X-24)/780,camera.ViewportSize.Y/650) scale.Scale=s hintScale.Scale=s end
 if active and free and camera then
  local rotation=CFrame.Angles(0,yaw,0)*CFrame.Angles(pitch,0,0)
  local move=Vector3.zero
  if not UIS:GetFocusedTextBox() then
   if UIS:IsKeyDown(Enum.KeyCode.W) then move+=Vector3.new(0,0,-1) end if UIS:IsKeyDown(Enum.KeyCode.S) then move+=Vector3.new(0,0,1) end
   if UIS:IsKeyDown(Enum.KeyCode.A) then move+=Vector3.new(-1,0,0) end if UIS:IsKeyDown(Enum.KeyCode.D) then move+=Vector3.new(1,0,0) end
   if UIS:IsKeyDown(Enum.KeyCode.E) then move+=Vector3.new(0,1,0) end if UIS:IsKeyDown(Enum.KeyCode.Q) then move+=Vector3.new(0,-1,0) end
  end
  local speed=UIS:IsKeyDown(Enum.KeyCode.LeftShift) and 65 or 25
  freeCF=CFrame.new(freeCF.Position+rotation:VectorToWorldSpace(move)*speed*dt)*rotation camera.CFrame=freeCF
 end
end)
script.Destroying:Connect(stop)
