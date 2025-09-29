"use client";

import { useState } from "react";
import { Star, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface RatingComponentProps {
  promptId: string;
  currentRating?: number;
  totalRatings: number;
  isFavorite: boolean;
  onRatingChange: (promptId: string, rating: number, comment?: string) => void;
  onFavoriteToggle: (promptId: string) => void;
  userRating?: number;
  userComment?: string;
  showDetails?: boolean;
}

export function RatingComponent({
  promptId,
  currentRating,
  totalRatings,
  isFavorite,
  onRatingChange,
  onFavoriteToggle,
  userRating,
  userComment,
  showDetails = false,
}: RatingComponentProps) {
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(userRating || 0);
  const [ratingComment, setRatingComment] = useState(userComment || "");

  const handleRatingSubmit = () => {
    if (selectedRating > 0) {
      onRatingChange(promptId, selectedRating, ratingComment);
      setIsRatingDialogOpen(false);
    }
  };

  const StarDisplay = ({ rating, size = "sm", interactive = false }: { 
    rating: number; 
    size?: "sm" | "md" | "lg";
    interactive?: boolean;
  }) => {
    const sizeClasses = {
      sm: "h-4 w-4",
      md: "h-5 w-5", 
      lg: "h-6 w-6"
    };

    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= Math.floor(rating);
          const isHalfFilled = star === Math.ceil(rating) && rating % 1 !== 0;
          
          return (
            <Star
              key={star}
              className={`${sizeClasses[size]} ${
                interactive ? "cursor-pointer transition-colors" : ""
              } ${
                isFilled
                  ? "fill-yellow-400 text-yellow-400"
                  : isHalfFilled
                  ? "fill-yellow-200 text-yellow-400"
                  : "text-gray-300"
              } ${
                interactive && hoverRating >= star
                  ? "fill-yellow-300 text-yellow-300"
                  : ""
              }`}
              onMouseEnter={() => interactive && setHoverRating(star)}
              onMouseLeave={() => interactive && setHoverRating(0)}
              onClick={() => interactive && setSelectedRating(star)}
            />
          );
        })}
      </div>
    );
  };

  if (showDetails) {
    return (
      <div className="space-y-4">
        {/* Rating Summary */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Rating</h4>
          <div className="flex items-center space-x-3">
            <StarDisplay rating={currentRating || 0} size="lg" />
            <div className="flex flex-col">
              <span className="text-lg font-semibold">
                {currentRating && currentRating > 0 ? currentRating.toFixed(1) : "N/A"}
              </span>
              <span className="text-xs text-muted-foreground">
                {totalRatings} {totalRatings === 1 ? "rating" : "ratings"}
              </span>
            </div>
          </div>
        </div>

        {/* User Rating */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Your Rating</h4>
          <div className="flex items-center justify-between">
            {userRating ? (
              <div className="flex items-center space-x-2">
                <StarDisplay rating={userRating} size="md" />
                <span className="text-sm text-muted-foreground">
                  You rated this {userRating} star{userRating !== 1 ? "s" : ""}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                Not rated yet
              </span>
            )}
            <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  {userRating ? "Update Rating" : "Rate Prompt"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rate this Prompt</DialogTitle>
                  <DialogDescription>
                    Share your experience with this prompt to help others.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Your Rating</label>
                    <div className="flex justify-center py-4">
                      <StarDisplay 
                        rating={hoverRating || selectedRating} 
                        size="lg" 
                        interactive={true}
                      />
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                      {selectedRating > 0 ? `${selectedRating} star${selectedRating !== 1 ? "s" : ""}` : "Select a rating"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Comment (Optional)</label>
                    <Textarea
                      placeholder="Share your thoughts about this prompt..."
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsRatingDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleRatingSubmit} disabled={selectedRating === 0}>
                      Submit Rating
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Favorite */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Favorite</h4>
          <Button
            variant={isFavorite ? "default" : "outline"}
            size="sm"
            onClick={() => onFavoriteToggle(promptId)}
            className="flex items-center space-x-2"
          >
            <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
            <span>{isFavorite ? "Favorited" : "Add to Favorites"}</span>
          </Button>
        </div>
      </div>
    );
  }

  // Compact version for cards and lists
  return (
    <div className="flex items-center space-x-2">
      <StarDisplay rating={currentRating || 0} size="sm" />
      <span className="text-xs text-muted-foreground">
        {currentRating && currentRating > 0 ? `${currentRating.toFixed(1)} (${totalRatings})` : `No ratings (${totalRatings})`}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onFavoriteToggle(promptId)}
        className="h-6 w-6 p-0"
      >
        <Heart className={`h-3 w-3 ${isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
      </Button>
    </div>
  );
}

// Rating distribution component for detailed view
interface RatingDistributionProps {
  ratings: Array<{ rating: number; count: number }>;
  totalRatings: number;
}

export function RatingDistribution({ ratings, totalRatings }: RatingDistributionProps) {
  const ratingCounts = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: ratings.find(r => r.rating === rating)?.count || 0,
    percentage: totalRatings > 0 ? (ratings.find(r => r.rating === rating)?.count || 0) / totalRatings * 100 : 0
  }));

  return (
    <div className="space-y-2">
      <h5 className="text-sm font-medium">Rating Distribution</h5>
      <div className="space-y-1">
        {ratingCounts.map(({ rating, count, percentage }) => (
          <div key={rating} className="flex items-center space-x-2 text-xs">
            <span className="w-8">{rating} star</span>
            <div className="flex-1 bg-muted rounded-full h-2">
              <div 
                className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="w-8 text-right text-muted-foreground">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}