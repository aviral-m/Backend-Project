import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllvideos = asyncHandler(async (req,res) =>{
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query

    if (!(query && sortBy && sortType && userId)){
        throw new ApiError(400, "Profile details are missing")
    }

    if (!(isValidObjectId(userId))){
        throw new ApiError(400, "Entered UserId is not a valid ObjectId")
    }

    const videos = await User.findById(userId)
    .sort({ createdAt : -1})
    .skip((page-1)*limit)
    .limit(limit)
    
    if (!videos){
        throw new ApiError(500, "Something went wrong while looking for the videos")
    }

    return res.status(200)
    .json(new ApiResponse(
        200,
        videos,
        "Videos successfully found"
    ))
    
})


const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video

    if (!(title && description)) {
        throw new ApiError(400, "Must provide both title and description")
    }

    const videoLocalPath = req.files?.videoFile[0]?.path;

    if (!videoLocalPath){
        throw new ApiError(400, "Video file is required")
    }
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

    if (!thumbnailLocalPath){
        throw new ApiError(400, "Thumbnail is required")
    }

    const videoFile = await uploadOnCloudinary(videoLocalPath)
    if (!videoFile){
        throw new ApiError(400, "Video file is required")
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    if (!thumbnail){
        throw new ApiError(400, "Thumbnail is required")
    }

    const video = await Video.create({
        videoFile : videoFile.url,
        thumbnail : thumbnail.url,
        title,
        description,
        duration : videoFile.duration,
        owner : req.user?._id,
    })

    if (!video) {
        throw new ApiError(500, "Something went wrong while publishing video")
    }

    return res.status(200)
    .json(new ApiResponse(
        200,
        video,
        "Video successfully published"
    ))

})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    if (!videoId?.trim()){
        throw new ApiError(400, "Video ID is missing")
    }
    
    if (!(isValidObjectId(videoId))){
        throw new ApiError(400, "Entered video ID is not a valid ObjectId")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(500, "Couldn't get the video" )
    }

    return res.status(200)
    .json(new ApiResponse(
        200,
        video,
        "Video successfully retrieved"
    ))
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail
    if (!videoId?.trim()){
        throw new ApiError(400, "Video ID is missing")
    }
    
    if (!(isValidObjectId(videoId))){
        throw new ApiError(400, "Entered video ID is not a valid ObjectId")
    }

    const { title, description } = req.body

    if (!(title && description)) {
        throw new ApiError(400, "Must provide both title and description")
    }

    const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

    if (!thumbnailLocalPath){
        throw new ApiError(400, "Thumbnail is required")
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
    if (!thumbnail){
        throw new ApiError(400, "Thumbnail is required")
    }

    const video = await Video.findByIdAndUpdate(videoId,
        {
            $set : {
                title,
                description,
                thumbnail : thumbnail.url
            }
        },
        {new : true}
    )

    if (!video) {
        throw new ApiError(500, "Couldn't get the video" )
    }

    return res.status(200,
        video,
        "Successfully updated the video"
    )


})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
    if (!videoId?.trim()){
        throw new ApiError(400, "Video ID is missing")
    }
    
    if (!(isValidObjectId(videoId))){
        throw new ApiError(400, "Entered video ID is not a valid ObjectId")
    }

    try {
        const deletedVideo = await Video.findByIdAndDelete(videoId)

        if (!deletedVideo){
            throw new ApiError(500, "Video not found")
        }

        return res.status(200)
        .json(200,deletedVideo, "Video successfully deleted")
    } catch (error) {
        throw new ApiError(500, "Something went wrong while searching for video")
    }

})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})


export {
    getAllvideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
}