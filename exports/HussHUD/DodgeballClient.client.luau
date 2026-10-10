local tool=script.Parent
local Players=game:GetService("Players")
local UIS=game:GetService("UserInputService")
local RS=game:GetService("ReplicatedStorage")
local player=Players.LocalPlayer
local mouse=player:GetMouse()
local throwRemote=RS:WaitForChild("GameRemotes"):WaitForChild("ThrowBall")
local config=require(RS:WaitForChild("HussThrowConfig"))
local lastThrow=-math.huge
tool.Activated:Connect(function()
 local char=player.Character
 local hum=char and char:FindFirstChildOfClass("Humanoid")
 if tool.Parent~=char or not hum or hum.Health<=0 or player:GetAttribute("PlayerRole")~="Thrower" then return end
 local now=workspace:GetServerTimeNow()
 if now-lastThrow<config.Cooldown then return end
 local camera=workspace.CurrentCamera
 if not camera then return end
 local ray=mouse.UnitRay
 local input=UIS:GetLastInputType()
 if input==Enum.UserInputType.Touch or string.find(input.Name,"Gamepad",1,true) then
  ray=camera:ViewportPointToRay(camera.ViewportSize.X*.5,camera.ViewportSize.Y*.5)
 end
 local params=RaycastParams.new()
 params.FilterType=Enum.RaycastFilterType.Exclude
 local ignored={char}
 local arena=workspace:FindFirstChild("Arena")
 if arena then for _,part in ipairs(arena:GetDescendants()) do
  if part:IsA("BasePart") and part.Transparency>=.99 then table.insert(ignored,part) end
 end end
 params.FilterDescendantsInstances=ignored
 params.RespectCanCollide=false
 local hit=workspace:Raycast(ray.Origin,ray.Direction*config.AimDistance,params)
 local target=hit and hit.Position or ray.Origin+ray.Direction*config.AimDistance
 lastThrow=now
 char:SetAttribute("R6Action","Throw")
 char:SetAttribute("R6ActionStart",now)
 throwRemote:FireServer(target)
 local handle=tool:FindFirstChild("Handle")
 local sound=handle and handle:FindFirstChild("ThrowSound")
 if sound then task.delay(config.ReleaseDelay,function() if tool.Parent==char then sound:Play() end end) end
end)
