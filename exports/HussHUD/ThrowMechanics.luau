-- Compute release from the animated throwing hand; never reposition the shooter.
local RS=game:GetService("ReplicatedStorage")
local Pack=require(RS:WaitForChild("HussR6AnimationPack").Player)
local config=require(RS:WaitForChild("HussThrowConfig"))
local Mechanics={}
function Mechanics.GetLaunch(char,target,radius)
 local root=char:FindFirstChild("HumanoidRootPart")
 if not root then return nil end
 local joints={}
 for _,j in ipairs(char:GetDescendants()) do if j:IsA("Motor6D") and j.Part1 then joints[j.Part1.Name]=j end end
 local pose=Pack.Sample("Throw",config.ReleaseDelay)
 local torso,arm=joints.Torso,joints["Right Arm"]
 local hand=root.Position+Vector3.new(1.2,.5,-1)
 if torso and arm then
  local torsoCF=root.CFrame*torso.C0*(pose.Torso or CFrame.identity)*torso.C1:Inverse()
  local armCF=torsoCF*arm.C0*(pose["Right Arm"] or CFrame.identity)*arm.C1:Inverse()
  hand=(armCF*CFrame.new(0,-arm.Part1.Size.Y*.5,0)).Position
 end
 local delta=target-hand
 local direction=delta.Magnitude>.1 and delta.Unit or root.CFrame.LookVector
 local spawn=hand+direction*(radius+.15)
 local origin=root.Position+Vector3.new(0,.5,0)
 local params=RaycastParams.new() params.FilterType=Enum.RaycastFilterType.Exclude
 params.FilterDescendantsInstances={char} params.RespectCanCollide=true
 local obstruction=workspace:Spherecast(origin,radius,spawn-origin,params)
 if obstruction then spawn=obstruction.Position+obstruction.Normal*(radius+.05) end
 delta=target-spawn
 direction=delta.Magnitude>.1 and delta.Unit or direction
 local boosted=(char:GetAttribute("PowerThrowUntil") or 0)>workspace:GetServerTimeNow()
 return spawn,direction*config.Speed*(boosted and 1.2 or 1)
end
function Mechanics.IgnoreShooter(ball,char)
 local folder=Instance.new("Folder") folder.Name="ShooterCollisionGrace" folder.Parent=ball
 for _,part in ipairs(char:GetDescendants()) do
  if part:IsA("BasePart") then
   local constraint=Instance.new("NoCollisionConstraint")
   constraint.Part0=ball constraint.Part1=part constraint.Parent=folder
  end
 end
 game:GetService("Debris"):AddItem(folder,.15)
end
return Mechanics
