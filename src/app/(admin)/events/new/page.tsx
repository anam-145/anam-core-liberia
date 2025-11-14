import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Label from '@/components/ui/Label';

export default function EventNewPage() {
  return (
    <>
      <h1 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 800 }}>Create New Event</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
        {/* Left: Basic Info */}
        <Card>
          <CardHeader>Basic Information</CardHeader>
          <CardBody>
            <div style={{ display: 'grid', gap: 14 }}>
              <Input label="Event Name" placeholder="Financial Literacy Workshop 2025" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="Start Date" type="datetime-local" />
                <Input label="End Date" type="datetime-local" />
              </div>
              <Select label="Event Type" defaultValue="">
                <option value="" disabled>
                  Select type
                </option>
                <option>WORKSHOP</option>
                <option>TRAINING</option>
                <option>DISTRIBUTION</option>
              </Select>
              <Input label="Location" placeholder="Monrovia, Liberia" />
              <div>
                <Label>Description</Label>
                <textarea className="textarea" rows={5} placeholder="Enter event description"></textarea>
                <div className="helper">Brief 2-3 sentence summary recommended</div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Right: Payment Options */}
        <Card>
          <CardHeader>Payment Configuration</CardHeader>
          <CardBody>
            <div style={{ display: 'grid', gap: 12 }}>
              <Select label="Token Type" defaultValue="">
                <option value="" disabled>
                  Select token
                </option>
                <option>USDC</option>
                <option>USDT</option>
                <option>CUSTOM_ERC20</option>
              </Select>
              <Input label="Token Address" placeholder="0x..." />
              <Input label="Amount per Day" type="number" placeholder="50.00" />
              <Input label="Max Participants" type="number" placeholder="100" />
              <Input label="Registration Deadline" type="datetime-local" />
              <label className="label">Options</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" /> <span>Payment Required</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" /> <span>Require KYC Approval</span>
              </label>
            </div>
          </CardBody>
          <CardFooter style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="secondary">Save as Draft</Button>
            <Button>Create Event</Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
