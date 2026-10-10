local RS=game:GetService('ReplicatedStorage')
local RunService=game:GetService('RunService')
local countdown=RS:FindFirstChild('BossEventCountdown') or Instance.new('Folder')
countdown.Name='BossEventCountdown'
local duration=30*60
countdown:SetAttribute('Duration',duration)
countdown:SetAttribute('Cycle',1)
countdown:SetAttribute('EndsAt',workspace:GetServerTimeNow()+duration)
countdown.Parent=RS
RunService.Heartbeat:Connect(function()
 local now=workspace:GetServerTimeNow()
 local endsAt=countdown:GetAttribute('EndsAt')
 if now>=endsAt then
  local cycles=math.floor((now-endsAt)/duration)+1
  countdown:SetAttribute('Cycle',countdown:GetAttribute('Cycle')+cycles)
  countdown:SetAttribute('EndsAt',endsAt+cycles*duration)
 end
end)

