'use client';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

export default function EventNewPage() {
  return (
    <>
      <h1 className="text-xl lg:text-2xl font-bold mb-4">Create New Event</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Basic Info */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>Basic Information</CardHeader>
            <CardBody>
              <div className="grid gap-4">
                <Input label="Event Name" placeholder="Financial Literacy Workshop 2025" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <label className="label">Description</label>
                  <textarea className="textarea" rows={5} placeholder="Enter event description"></textarea>
                  <div className="helper">Brief 2-3 sentence summary recommended</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right: Payment Options */}
        <Card>
          <CardHeader>Payment Configuration</CardHeader>
          <CardBody>
            <div className="grid gap-3">
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
              <label className="flex items-center gap-2">
                <input type="checkbox" /> <span>Payment Required</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" /> <span>Require KYC Approval</span>
              </label>
            </div>
          </CardBody>
          <CardFooter>
            <div className="flex justify-end gap-2 w-full">
              <Button variant="secondary">Save as Draft</Button>
              <Button>Create Event</Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
