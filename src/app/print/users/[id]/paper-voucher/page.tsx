import { notFound } from 'next/navigation';
import { AppDataSource } from '@/server/db/datasource';
import { User } from '@/server/db/entities/User';
import { CustodyWallet } from '@/server/db/entities/CustodyWallet';
import { DidDocument } from '@/server/db/entities/DidDocument';
import PrintPageWrapper from '@/components/print/PrintPageWrapper';
import PaperVoucherCard from '@/components/print/PaperVoucherCard';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function PaperVoucherPage({ params }: PageProps) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    notFound();
  }

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const userRepository = AppDataSource.getRepository(User);
  const custodyRepository = AppDataSource.getRepository(CustodyWallet);
  const didRepository = AppDataSource.getRepository(DidDocument);

  // Find user by numeric id
  const user = await userRepository.findOne({
    where: { id },
  });

  if (!user) {
    notFound();
  }

  if (!user.hasCustodyWallet) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="card max-w-md">
          <div className="card__header">종이바우처 발급 불가</div>
          <div className="card__body">
            <p>이 사용자는 커스터디 지갑이 없어 종이바우처를 발급할 수 없습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  // Get custody wallet by userId (UUID)
  const custody = await custodyRepository.findOne({
    where: { userId: user.userId },
  });

  if (!custody) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="card max-w-md">
          <div className="card__header">커스터디 지갑 없음</div>
          <div className="card__body">
            <p>커스터디 지갑을 찾을 수 없습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  // Get DID document by wallet address
  const didDocument = user.walletAddress
    ? await didRepository.findOne({
        where: { walletAddress: user.walletAddress },
      })
    : null;

  // Build payload in Paper Voucher format
  const payload = {
    address: user.walletAddress,
    vault: custody.vault,
    vc: custody.vc,
  };

  return (
    <PrintPageWrapper>
      <PaperVoucherCard
        user={{
          name: user.name,
          did: didDocument?.did || null,
          walletAddress: user.walletAddress,
          kycFacePath: user.kycFacePath,
        }}
        payload={payload}
      />
    </PrintPageWrapper>
  );
}
