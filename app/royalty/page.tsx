"use client";

import { useEffect, useState } from "react";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Thumbnail,
  Spinner,
  EmptyState,
  Badge,
  Button,
  Tooltip,
  Frame,
  Toast,
} from "@shopify/polaris";
import { EditIcon, DeleteIcon, ViewIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useRouter } from "next/navigation";
import EditRoyaltyModal from "../components/editroyality";
import DeleteConfirmationModal from "../components/dialog";

interface Royalty {
  id: string;
  productId: string;
  shopifyId: string;
  title: string;
  image?: string | null;
  status?: string | null;
  price?: number | null;
  designerId: string;
  Royality: number;
  shop?: string | null;
}

interface ApiResponse {
  royalties: Royalty[];
  count: number;
}

export default function RoyaltiesPage() {
  const app = useAppBridge();
  const router = useRouter();

  const [shop, setShop] = useState<string | null>(null);
  const [royalties, setRoyalties] = useState<Royalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeEdit, setActiveEdit] = useState<Royalty | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Royalty | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toast states
  const [toastContent, setToastContent] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);

  useEffect(() => {
    const shopFromConfig = app?.config?.shop;
    if (shopFromConfig) {
      setShop(shopFromConfig);
    } else {
      setError("Unable to retrieve shop info. Please reload the app.");
    }
  }, [app]);

  // Fetch royalties
  const fetchRoyalties = async () => {
    if (!shop) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/royality?shop=${shop}`);
      if (!res.ok) throw new Error("Failed to fetch royalties");

      const data: ApiResponse = await res.json();
      setRoyalties(data.royalties || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoyalties();
  }, [shop]);

  // Delete royalty
  const handleDelete = async () => {
    if (!shop || !deleteTarget) return;
    setDeleteLoading(true);

    try {
      const res = await fetch(
        `/api/royality/product/${deleteTarget.shopifyId}/delete?shop=${shop}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete royalty");
      }
      await fetchRoyalties();
      setToastContent("Royalty deleted successfully");
      setToastError(false);
      setDeleteTarget(null); // close modal
    } catch (err) {
      setToastContent(err instanceof Error ? err.message : "Something went wrong");
      setToastError(true);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Edit royalty
  const handleUpdate = async (shopifyId: string, newRoyality: number) => {
    if (!shop || !shopifyId) return;

    try {
      const res = await fetch(
        `/api/royality/product/${shopifyId}/edit?shop=${shop}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Royality: newRoyality }),
        },
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update royalty");
      }

      await fetchRoyalties();
      setActiveEdit(null);
      setToastContent("Royalty updated successfully");
      setToastError(false);
    } catch (err) {
      setToastContent(err instanceof Error ? err.message : "Something went wrong");
      setToastError(true);
    }
  };

  return (
    <Frame>
      <Page
        title="Product Royalties"
        backAction={{ content: "Back", onAction: () => router.back() }}
      >
        <Card>
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Spinner accessibilityLabel="Loading royalties" size="large" />
            </div>
          ) : error ? (
            <div className="p-8 text-red-600">{error}</div>
          ) : royalties.length === 0 ? (
            <EmptyState
              heading="No royalties assigned yet"
              action={{ content: "Assign Royalty", url: "/royalty/create" }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>
                You haven’t assigned any royalties yet. Start by linking a
                designer to a product.
              </p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: "royalty", plural: "royalties" }}
              itemCount={royalties.length}
              selectable={false}
              headings={[
                { title: "Product" },
                { title: "Royalty %", alignment: "center" },
                { title: "Price", alignment: "center" },
                { title: "Actions", alignment: "center" },
              ]}
            >
              {royalties.map((royalty, index) => (
                <IndexTable.Row
                  id={royalty.id}
                  key={royalty.id}
                  position={index}
                >
                  {/* Product info */}
                  <IndexTable.Cell>
                    <div className="flex items-center gap-2 min-w-[220px] max-w-[240px] truncate">
                      <Thumbnail
                        source={
                          royalty.image ||
                          "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"
                        }
                        alt={royalty.title}
                      />
                      <Text as="span" truncate>
                        {royalty.title}
                      </Text>
                    </div>
                  </IndexTable.Cell>

                  {/* Royalty % */}
                  <IndexTable.Cell>
                    <div className="flex justify-center min-w-[100px]">
                      <Badge tone="success">{`${royalty.Royality}%`}</Badge>
                    </div>
                  </IndexTable.Cell>

                  {/* Price */}
                  <IndexTable.Cell>
                    <div className="flex justify-center min-w-[120px]">
                      {royalty.price !== null && royalty.price !== undefined
                        ? royalty.price.toFixed(2)
                        : "—"}
                    </div>
                  </IndexTable.Cell>

                  {/* Actions */}
                  <IndexTable.Cell>
                    <div className="flex justify-end w-full gap-5 pr-12">
                      <Tooltip content="Edit Royalty">
                        <Button
                          size="slim"
                          icon={EditIcon}
                          onClick={() => setActiveEdit(royalty)}
                        />
                      </Tooltip>
                      <Tooltip content="Delete Royalty">
                        <Button
                          size="slim"
                          tone="critical"
                          icon={DeleteIcon}
                          onClick={() => setDeleteTarget(royalty)}
                        />
                      </Tooltip>
                      <Tooltip content="View Product in Shopify Admin">
                        <Button
                          size="slim"
                          icon={ViewIcon}
                          onClick={() => {
                            if (!shop) return;
                            const storeHandle = shop.replace(
                              ".myshopify.com",
                              "",
                            );
                            const shopifyAdminUrl = `https://admin.shopify.com/store/${storeHandle}/products/${royalty.shopifyId}`;
                            window.open(shopifyAdminUrl, "_blank");
                          }}
                        />
                      </Tooltip>
                    </div>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          )}
        </Card>

        {/* Edit Modal */}
        {activeEdit && (
          <EditRoyaltyModal
            open
            royalty={activeEdit}
            onClose={() => setActiveEdit(null)}
            onUpdate={handleUpdate}
          />
        )}

        {/* Delete Modal */}
        {deleteTarget && (
          <DeleteConfirmationModal
            open
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            loading={deleteLoading}
            title="Delete Royalty?"
            message={`Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone.`}
            confirmText="Delete"
            cancelText="Cancel"
          />
        )}

        {/* Toast Notification */}
        {toastContent && (
          <Toast
            content={toastContent}
            error={toastError}
            onDismiss={() => setToastContent(null)}
          />
        )}
      </Page>
    </Frame>
  );
}
